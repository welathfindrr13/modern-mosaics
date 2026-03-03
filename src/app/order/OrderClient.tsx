'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ensurePublicId } from '@/utils/gelatoUrls'
import ProductMockup from '@/components/orders/ProductMockup'
import ShippingForm from '@/components/orders/ShippingForm'
import { PrintConfidencePanel } from '@/components/ui/PrintConfidencePanel'
import { formatPrice } from '@/utils/priceUtils'
import { getCurrencyForCountry } from '@/utils/currency'
import { GelatoAddress, GelatoShippingMethod } from '@/lib/gelato'
import {
  ProductType,
  SizeKey,
  PRINT_LAB_CATALOG,
  resolveSkuUid,
  getPrice,
  getSupportedProductTypes,
  getAvailableSizes,
} from '@/data/printLabCatalog'
import {
  evaluatePrintQualityForSize,
  getRecommendedSizeKey,
} from '@/utils/printQuality'

// =============================================================================
// CROP PARAMS TYPE + UTILITIES
// Normalized crop coordinates (0-1 range relative to source image)
// =============================================================================
export interface CropParams {
  x: number       // Left edge (0-1)
  y: number       // Top edge (0-1)
  width: number   // Crop width (0-1)
  height: number  // Crop height (0-1)
  rotation?: 0 | 90 | 180 | 270
}

/**
 * Parse crop params from URL query string
 * Format: "x,y,width,height,rotation?" e.g. "0.1,0.2,0.6,0.7,90"
 */
function parseCropParams(cropStr: string | null): CropParams | null {
  if (!cropStr) return null
  
  const parts = cropStr.split(',').map(s => s.trim())
  if (parts.length < 4) return null
  
  const [xStr, yStr, wStr, hStr, rotStr] = parts
  let x = parseFloat(xStr)
  let y = parseFloat(yStr)
  let width = parseFloat(wStr)
  let height = parseFloat(hStr)
  
  // Validate numbers
  if ([x, y, width, height].some(n => isNaN(n))) return null
  
  // Clamp x,y to [0,1]
  x = Math.max(0, Math.min(1, x))
  y = Math.max(0, Math.min(1, y))
  
  // Clamp width,height to (0,1]
  width = Math.max(0.01, Math.min(1, width))
  height = Math.max(0.01, Math.min(1, height))
  
  // Ensure x+width <= 1 and y+height <= 1
  if (x + width > 1) width = 1 - x
  if (y + height > 1) height = 1 - y
  
  // Parse rotation (optional)
  let rotation: 0 | 90 | 180 | 270 | undefined
  if (rotStr) {
    const rot = parseInt(rotStr, 10)
    if (rot === 0 || rot === 90 || rot === 180 || rot === 270) {
      rotation = rot
    }
  }
  
  return { x, y, width, height, rotation }
}

/**
 * Build Cloudinary crop transform string from normalized params
 * Returns empty string if params invalid
 */
function buildCropTransform(
  cropParams: CropParams,
  sourceWidth: number,
  sourceHeight: number
): string {
  const px_x = Math.round(sourceWidth * cropParams.x)
  const px_y = Math.round(sourceHeight * cropParams.y)
  const px_w = Math.round(sourceWidth * cropParams.width)
  const px_h = Math.round(sourceHeight * cropParams.height)
  
  let transform = ''
  if (cropParams.rotation) {
    transform += `a_${cropParams.rotation}/`
  }
  transform += `c_crop,x_${px_x},y_${px_y},w_${px_w},h_${px_h}/`
  
  return transform
}

// =============================================================================
// CANONICAL ASPECT RATIOS (not bleed pixels)
// Used for preview sizing to match print proportions
// =============================================================================
const SIZE_ASPECT_RATIOS: Record<SizeKey, { w: number; h: number }> = {
  '8x10': { w: 4, h: 5 },   // 4:5
  '12x16': { w: 3, h: 4 },  // 3:4
  '16x20': { w: 4, h: 5 },  // 4:5
  '18x24': { w: 3, h: 4 },  // 3:4
}

const RECOMMENDED_SIZE_ORDER: SizeKey[] = ['18x24', '16x20', '12x16', '8x10']

/**
 * Get preview dimensions for a size key
 * Long edge = maxEdge (1200), short edge computed by ratio
 */
function getPreviewDimensions(sizeKey: SizeKey | null, maxEdge = 1200): { w: number; h: number } {
  if (!sizeKey || !SIZE_ASPECT_RATIOS[sizeKey]) {
    // Fallback to 3:4 ratio
    return { w: Math.round(maxEdge * 0.75), h: maxEdge }
  }
  
  const ratio = SIZE_ASPECT_RATIOS[sizeKey]
  // Portrait orientation: height is long edge
  const aspectRatio = ratio.w / ratio.h
  return {
    w: Math.round(maxEdge * aspectRatio),
    h: maxEdge
  }
}

interface OrderClientProps {
  imageIdentifier: string
}

// =============================================================================
// DETERMINISTIC ENHANCEMENT TRANSFORMS
// Must match PHOTO_ENHANCEMENTS in create/page.tsx and cloudinaryPrint.ts
// =============================================================================
const PREVIEW_TRANSFORMS: Record<string, string> = {
  enhance: 'e_improve',
  warmer: 'e_tint:40:orange',
  cooler: 'e_tint:40:blue',
  brighter: 'e_brightness:20',
  sharper: 'e_sharpen:100',
  denoise: 'e_noise_reduction:80',
}

export default function OrderClient({ imageIdentifier }: OrderClientProps) {
  const router = useRouter()
  
  // ==========================================================================
  // PRINT LAB STATE (catalog-driven)
  // ==========================================================================
  const supportedTypes = useMemo(() => getSupportedProductTypes(), [])
  const [selectedProductType, setSelectedProductType] = useState<ProductType>(supportedTypes[0] || 'poster')
  const [selectedSizeKey, setSelectedSizeKey] = useState<SizeKey | null>(null)
  
  // Derived: available sizes for current product type
  const availableSizes = useMemo(
    () => getAvailableSizes(selectedProductType),
    [selectedProductType]
  )
  
  // Derived: catalog config for current product type
  const catalogConfig = useMemo(
    () => PRINT_LAB_CATALOG[selectedProductType],
    [selectedProductType]
  )
  
  // Derived: resolved SKU UID (null if invalid selection)
  const resolvedSkuUid = useMemo(() => {
    if (!selectedSizeKey) return null
    return resolveSkuUid({ productType: selectedProductType, sizeKey: selectedSizeKey })
  }, [selectedProductType, selectedSizeKey])
  
  // ==========================================================================
  // SERVER-DERIVED PRICING STATE (currency-converted for ALL sizes)
  // ==========================================================================
  
  // Converted prices for all available sizes (fetched from server)
  const [convertedOptions, setConvertedOptions] = useState<Record<string, {
    price: number;
    baseGBP: number;
    fxRate: number;
    stripeUnitAmount: number;
  }>>({})
  
  // Server-confirmed currency (derived from country)
  const [pricingCurrency, setPricingCurrency] = useState<string>('GBP')
  
  // Loading state for price conversion
  const [isFetchingPrices, setIsFetchingPrices] = useState(false)
  
  // Legacy serverPrice state (for backward compatibility with single-size fetch)
  const [serverPrice, setServerPrice] = useState<{
    price: number;
    baseGBP: number;
    currency: string;
    fxRate: number;
  } | null>(null)
  
  // Product price: use converted price from batch fetch, then serverPrice, then catalog fallback
  const productPrice = useMemo(() => {
    if (selectedSizeKey && convertedOptions[selectedSizeKey]) {
      return convertedOptions[selectedSizeKey].price
    }
    if (serverPrice?.price) {
      return serverPrice.price
    }
    return selectedSizeKey ? (getPrice({ productType: selectedProductType, sizeKey: selectedSizeKey }) || 0) : 0
  }, [selectedSizeKey, convertedOptions, serverPrice, selectedProductType])
  
  // SKU resolution error (guardrail)
  const skuError = useMemo(() => {
    if (!selectedSizeKey) return null
    if (!resolvedSkuUid) {
      return `This ${catalogConfig.title} size is not currently available. Please select a different option.`
    }
    return null
  }, [selectedSizeKey, resolvedSkuUid, catalogConfig])
  
  // ==========================================================================
  // OTHER STATE
  // ==========================================================================
  const [loading, setLoading] = useState(false) // No longer loading products from API
  const [shippingAddress, setShippingAddress] = useState<GelatoAddress | null>(null)
  const [isAddressValid, setIsAddressValid] = useState(false)
  
  // ==========================================================================
  // COUNTRY SELECTION (decoupled from full address for early pricing)
  // ==========================================================================
  const [selectedCountry, setSelectedCountry] = useState<string>('GB')
  const [shippingOptions, setShippingOptions] = useState<GelatoShippingMethod[]>([])
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<GelatoShippingMethod | null>(null)
  const [orderTotal, setOrderTotal] = useState(0)
  const [isQuoting, setIsQuoting] = useState(false)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cleanedPublicId, setCleanedPublicId] = useState<string | null>(null)
  const [imageExists, setImageExists] = useState<boolean | null>(null)
  const [imageDetails, setImageDetails] = useState<any>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  
  // Image quality assessment for selected size
  // NOTE: Must be declared AFTER imageDetails useState to avoid TDZ error
  const imageQuality = useMemo(() => {
    if (!selectedSizeKey) return null
    const sourceWidth = imageDetails?.width
    const sourceHeight = imageDetails?.height
    return evaluatePrintQualityForSize(sourceWidth, sourceHeight, selectedSizeKey)
  }, [selectedSizeKey, imageDetails?.width, imageDetails?.height])
  const sizeQualityMap = useMemo(() => {
    const sourceWidth = imageDetails?.width
    const sourceHeight = imageDetails?.height
    const result: Record<string, ReturnType<typeof evaluatePrintQualityForSize>> = {}

    for (const sizeOption of availableSizes) {
      result[sizeOption.key] = evaluatePrintQualityForSize(sourceWidth, sourceHeight, sizeOption.key)
    }

    return result
  }, [availableSizes, imageDetails?.width, imageDetails?.height])
  const recommendedSizeKey = useMemo(() => {
    const preferredAvailable = RECOMMENDED_SIZE_ORDER.filter(sizeKey =>
      availableSizes.some(option => option.key === sizeKey)
    )
    return getRecommendedSizeKey(
      imageDetails?.width,
      imageDetails?.height,
      preferredAvailable
    )
  }, [availableSizes, imageDetails?.width, imageDetails?.height])
  const recommendedSizeLabel = useMemo(() => {
    if (!recommendedSizeKey) return null
    return availableSizes.find(option => option.key === recommendedSizeKey)?.label || null
  }, [availableSizes, recommendedSizeKey])
  const [isVerifyingImage, setIsVerifyingImage] = useState(false)
  const [currentCurrency, setCurrentCurrency] = useState('GBP')
  const [isZoomed, setIsZoomed] = useState(false)
  
  // DETERMINISTIC: Parse transforms from URL query params
  // These are Cloudinary enhancement keys passed from Create page
  const [transforms, setTransforms] = useState<string | null>(null)
  
  // CROP PARAMS: Parsed from URL for deterministic crop (v1)
  const [cropParams, setCropParams] = useState<CropParams | null>(null)
  
  // Auto-select first available size when product type changes
  useEffect(() => {
    if (availableSizes.length > 0 && !selectedSizeKey) {
      setSelectedSizeKey(availableSizes[0].key)
    } else if (availableSizes.length > 0 && selectedSizeKey) {
      // Check if current size is available for new product type
      const sizeStillAvailable = availableSizes.some(s => s.key === selectedSizeKey)
      if (!sizeStillAvailable) {
        setSelectedSizeKey(availableSizes[0].key)
      }
    }
  }, [availableSizes, selectedSizeKey])

  useEffect(() => {
    if (!selectedSizeKey || !recommendedSizeKey) return
    if (sizeQualityMap[selectedSizeKey]?.status !== 'poor') return
    setSelectedSizeKey(recommendedSizeKey)
  }, [selectedSizeKey, recommendedSizeKey, sizeQualityMap])
  
  // Parse transforms and crop params from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    
    // Parse enhancement transforms
    const transformsParam = urlParams.get('transforms')
    if (transformsParam) {
      setTransforms(transformsParam)
    }
    
    // Parse crop params (v1)
    const cropParam = urlParams.get('crop')
    if (cropParam) {
      const parsed = parseCropParams(cropParam)
      if (parsed) {
        setCropParams(parsed)
      } else {
        console.warn('[ORDER] Invalid crop param format')
      }
    }
  }, [])
  
  // Clean and process the publicId
  useEffect(() => {
    if (imageIdentifier) {
      try {
        if (imageIdentifier.startsWith('http')) {
          const url = new URL(imageIdentifier)
          const pathParts = url.pathname.split('/upload/')
          if (pathParts.length > 1) {
            const publicIdWithTransforms = pathParts[1]
            const publicIdParts = publicIdWithTransforms.split('/')
            // Include full folder path (modern-mosaics/userId/filename = 3 segments)
            setCleanedPublicId(publicIdParts.slice(-3).join('/'))
            setImageUrl(imageIdentifier)
            setImageExists(true)
          }
        } else {
          const cleaned = ensurePublicId(imageIdentifier)
          setCleanedPublicId(cleaned)
        }
      } catch (error) {
        console.error('[ORDER] Error processing image ID')
        setError('Error processing image ID.')
      }
    }
  }, [imageIdentifier])
  
  // Helper to build preview URL with transforms, crop, and size-aware dimensions
  const buildPreviewUrl = (
    publicId: string, 
    transformsStr: string | null,
    sizeKey: SizeKey | null,
    crop: CropParams | null,
    sourceWidth: number | null,
    sourceHeight: number | null
  ): string => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    
    // 1. Build crop transform (if crop params + source dimensions available)
    let cropTransform = ''
    if (crop && sourceWidth && sourceHeight) {
      cropTransform = buildCropTransform(crop, sourceWidth, sourceHeight)
    }
    
    // 2. Build enhancement transform string
    const enhancementTransform = transformsStr
      ? transformsStr.split(',').map(key => PREVIEW_TRANSFORMS[key.trim()]).filter(Boolean).join('/') + '/'
      : ''
    
    // 3. Get size-aware preview dimensions
    const { w: previewW, h: previewH } = getPreviewDimensions(sizeKey)
    
    // 4. Build final URL
    // If crop exists, use deterministic c_scale (no g_auto)
    // If no crop, use c_fill,g_auto for backward compatibility
    if (crop && sourceWidth && sourceHeight) {
      // Deterministic: crop → enhancements → scale
      return `https://res.cloudinary.com/${cloudName}/image/upload/${cropTransform}${enhancementTransform}c_scale,w_${previewW},h_${previewH}/${publicId}`
    } else {
      // Legacy: auto-crop with size-aware dimensions
      return `https://res.cloudinary.com/${cloudName}/image/upload/${enhancementTransform}c_fill,g_auto,w_${previewW},h_${previewH}/${publicId}`
    }
  }
  
  // ==========================================================================
  // AUTO-DETECT COUNTRY FROM BROWSER LOCALE (on mount)
  // ==========================================================================
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    
    const locale = navigator.language || 'en-GB'
    const parts = locale.split('-')
    const countryCode = parts[1]?.toUpperCase()
    
    // List of supported countries (matches shipping form)
    const supportedCountries = ['GB', 'US', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'PT', 'JP', 'CN', 'SG', 'HK', 'NZ']
    
    if (countryCode && supportedCountries.includes(countryCode)) {
      setSelectedCountry(countryCode)
    } else {
      // Default fallback
      setSelectedCountry('GB')
    }
  }, [])
  
  // Verify image exists
  useEffect(() => {
    const abortController = new AbortController()
    
    async function verifyImage() {
      if (!cleanedPublicId || imageUrl) return
      
      try {
        setIsVerifyingImage(true)
        
        const response = await fetch('/api/images/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ imageIdentifier: cleanedPublicId }),
          signal: abortController.signal
        })
        
        if (abortController.signal.aborted) return
        
        const data = await response.json()
        
        if (data.exists) {
          setImageExists(true)
          setImageDetails(data.imageDetails)
          // Build preview URL with transforms, crop, and size-aware dimensions
          const optimizedUrl = buildPreviewUrl(
            cleanedPublicId, 
            transforms,
            selectedSizeKey,
            cropParams,
            data.imageDetails?.width || null,
            data.imageDetails?.height || null
          )
          setImageUrl(optimizedUrl)
        } else {
          setImageExists(false)
          setError('Image not found')
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setImageExists(false)
          setError('Failed to verify image')
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsVerifyingImage(false)
        }
      }
    }
    
    verifyImage()
    return () => abortController.abort()
  }, [cleanedPublicId, transforms])
  
  // ==========================================================================
  // REBUILD PREVIEW URL when sizeKey or cropParams change
  // This ensures preview matches selected print size ratio
  // ==========================================================================
  useEffect(() => {
    if (!cleanedPublicId || !imageDetails) return
    
    const newUrl = buildPreviewUrl(
      cleanedPublicId,
      transforms,
      selectedSizeKey,
      cropParams,
      imageDetails.width,
      imageDetails.height
    )
    setImageUrl(newUrl)
  }, [selectedSizeKey, cropParams, cleanedPublicId, transforms, imageDetails])
  
  // ==========================================================================
  // FETCH CONVERTED PRICES FOR ALL SIZES (batch, on country or productType change)
  // Uses selectedCountry (auto-detected or user-selected) for early pricing
  // ==========================================================================
  useEffect(() => {
    async function fetchConvertedPrices() {
      // selectedCountry is always set (default GB), so we always have pricing
      if (!selectedCountry) {
        setConvertedOptions({})
        setPricingCurrency('GBP')
        setCurrentCurrency('GBP')
        return
      }
      
      try {
        setIsFetchingPrices(true)
        
        const params = new URLSearchParams({
          productType: selectedProductType,
          country: selectedCountry, // Use selectedCountry, not shippingAddress.country
        })
        
        const response = await fetch(`/api/pricing/options?${params}`, {
          credentials: 'include',
        })
        
        if (!response.ok) {
          console.error('[ORDER] Failed to fetch converted prices, falling back to GBP')
          setConvertedOptions({})
          setPricingCurrency('GBP')
          setCurrentCurrency('GBP')
          return
        }
        
        const data = await response.json()
        
        // Build convertedOptions map from response
        const optionsMap: Record<string, { price: number; baseGBP: number; fxRate: number; stripeUnitAmount: number }> = {}
        for (const opt of data.options) {
          optionsMap[opt.sizeKey] = {
            price: opt.price,
            baseGBP: opt.baseGBP,
            fxRate: opt.fxRate,
            stripeUnitAmount: opt.stripeUnitAmount,
          }
        }
        
        setConvertedOptions(optionsMap)
        setPricingCurrency(data.currency)
        setCurrentCurrency(data.currency)
        
        // Also update legacy serverPrice for selected size (backward compatibility)
        if (selectedSizeKey && optionsMap[selectedSizeKey]) {
          setServerPrice({
            price: optionsMap[selectedSizeKey].price,
            baseGBP: optionsMap[selectedSizeKey].baseGBP,
            currency: data.currency,
            fxRate: optionsMap[selectedSizeKey].fxRate,
          })
        }
        
      } catch (error) {
        console.error('[ORDER] Error fetching converted prices:', error)
        setConvertedOptions({})
        setPricingCurrency('GBP')
        setCurrentCurrency('GBP')
      } finally {
        setIsFetchingPrices(false)
      }
    }
    
    fetchConvertedPrices()
  }, [selectedProductType, selectedCountry, selectedSizeKey])
  
  // ==========================================================================
  // GET SHIPPING QUOTE (uses resolved SKU UID, server-derived currency)
  // ==========================================================================
  useEffect(() => {
    async function getShippingQuote() {
      if (!resolvedSkuUid || !shippingAddress || !isAddressValid) {
        setShippingOptions([])
        setSelectedShippingMethod(null)
        // Show product price even without shipping (use converted if available)
        setOrderTotal(productPrice)
        return
      }
      
      try {
        setIsQuoting(true)
        setError(null)
        
        // Note: Server will derive currency from country
        const response = await fetch('/api/orders/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            productUid: resolvedSkuUid,
            quantity: 1,
            shippingAddress,
          })
        })
        
        if (!response.ok) throw new Error('Failed to get quote')
        
        const data = await response.json()
        
        // Server returns derivedCurrency - should match our pricingCurrency
        if (data.derivedCurrency && data.derivedCurrency !== pricingCurrency) {
          console.warn(
            `[ORDER] Currency mismatch: batch pricing has ${pricingCurrency}, quote has ${data.derivedCurrency}`
          )
          setPricingCurrency(data.derivedCurrency)
          setCurrentCurrency(data.derivedCurrency)
        }
        
        if (data.shippingMethods?.length) {
          setShippingOptions(data.shippingMethods)
          setSelectedShippingMethod(data.shippingMethods[0])
          // Use productPrice (which now uses convertedOptions) + shipping
          setOrderTotal(productPrice + data.shippingMethods[0].price)
        }
      } catch (error: any) {
        setError(`Failed to get shipping quote: ${error.message}`)
        setShippingOptions([])
        setSelectedShippingMethod(null)
      } finally {
        setIsQuoting(false)
      }
    }
    
    getShippingQuote()
  }, [resolvedSkuUid, shippingAddress, isAddressValid, productPrice, pricingCurrency])
  
  const handleShippingMethodSelect = (method: GelatoShippingMethod) => {
    setSelectedShippingMethod(method)
    // Use converted product price for total calculation
    setOrderTotal(productPrice + method.price)
  }
  
  // Ensure orderTotal updates when productPrice changes (e.g., after prices loaded)
  useEffect(() => {
    if (selectedShippingMethod) {
      setOrderTotal(productPrice + selectedShippingMethod.price)
    } else {
      setOrderTotal(productPrice)
    }
  }, [productPrice, selectedShippingMethod])
  
  const handlePlaceOrder = async () => {
    // Guardrail: Must have resolved SKU
    if (!resolvedSkuUid) {
      setError('Cannot proceed: Product configuration is invalid')
      return
    }
    
    if (!selectedShippingMethod || !shippingAddress || !isAddressValid || !imageIdentifier) {
      setError('Missing required information')
      return
    }

    if (imageExists === false) {
      setError('Cannot place order: Image not found')
      return
    }
    
    try {
      setIsPlacingOrder(true)
      setError(null)
      
      // Note: Server will derive currency from shipping country
      // We pass shippingCurrency for validation
      // Serialize crop params for URL/metadata if present
      const cropParamsStr = cropParams 
        ? `${cropParams.x},${cropParams.y},${cropParams.width},${cropParams.height}${cropParams.rotation ? `,${cropParams.rotation}` : ''}`
        : undefined
      
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          // Use resolved SKU UID from catalog
          productUid: resolvedSkuUid,
          imagePublicId: cleanedPublicId || imageIdentifier,
          transforms: transforms || '', // DETERMINISTIC: Pass Cloudinary enhancement keys
          quantity: 1,
          shippingAddress,
          shippingMethodUid: selectedShippingMethod.uid,
          // Pass sizeKey for dimension lookup (new approach)
          sizeKey: selectedSizeKey,
          // Legacy size field for backward compatibility
          size: selectedSizeKey?.toUpperCase() || 'MEDIUM',
          // Currency info (server will validate, derive from country)
          // productPrice is IGNORED by server - it computes server-side
          productPrice: productPrice,
          shippingCost: selectedShippingMethod.price,
          // Pass shipping currency for server validation (use server-confirmed pricingCurrency)
          shippingCurrency: pricingCurrency,
          // total is IGNORED by server - it computes server-side
          total: orderTotal,
          // Product name from catalog
          productName: `${catalogConfig.title} – ${availableSizes.find(s => s.key === selectedSizeKey)?.label || selectedSizeKey}`,
          // v1: Crop params for deterministic cropping (passed to checkout metadata → order creation)
          cropParams: cropParamsStr,
          sourceWidth: imageDetails?.width,
          sourceHeight: imageDetails?.height,
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout')
      }
      
      const data = await response.json()
      
      // Log the derived currency from server for debugging
      if (data.derivedCurrency && data.derivedCurrency !== pricingCurrency) {
        console.warn(
          `[ORDER] Currency mismatch: UI has ${pricingCurrency}, server derived ${data.derivedCurrency}`
        )
      }
      
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (error: any) {
      setError(`Failed to proceed: ${error.message}`)
      setIsPlacingOrder(false)
    }
  }
  
  // No loading state needed - catalog is static
  
  // Error state (no supported product types - shouldn't happen)
  if (supportedTypes.length === 0) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="fixed inset-0 bg-glow-gradient opacity-30 pointer-events-none" />
        <div className="relative max-w-md mx-auto px-4">
          <div className="glass-card p-8 text-center">
            <span className="text-5xl mb-4 block">⚠️</span>
            <h2 className="text-xl font-display font-semibold text-white mb-2">No Products Available</h2>
            <p className="text-dark-400 mb-6">Please try again later.</p>
            <Link href="/gallery" className="btn-primary">
              Return to Gallery
            </Link>
          </div>
        </div>
      </div>
    )
  }
  
  const shippingPrice = selectedShippingMethod?.price || 0
  const isLowQualityForSelectedSize = imageQuality?.status === 'poor'
  
  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      {/* Background effects */}
      <div className="fixed inset-0 bg-glow-gradient opacity-30 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/gallery" className="inline-flex items-center text-dark-400 hover:text-brand-400 transition-colors mb-4 group">
            <svg className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Gallery
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Complete Your <span className="text-gradient">Order</span>
          </h1>
          <p className="text-dark-400 mt-2">Select your print and we'll ship it worldwide</p>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT COLUMN - Product Preview (45-50% width) */}
          <div className="w-full lg:w-1/2">
            <div className="sticky top-28 space-y-6">
              {/* Main Product Mockup */}
              <ProductMockup
                imageUrl={imageUrl}
                productUid={resolvedSkuUid || undefined}
                isLoading={isVerifyingImage}
                imageExists={imageExists}
              />
              
              {/* Quality Badges - Product-specific */}
              <div className="glass-card p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {selectedProductType === 'canvas' ? (
                    <>
                      <div>
                        <div className="text-brand-400 text-2xl mb-1">✓</div>
                        <p className="text-xs text-dark-300">FSC Wood Frame</p>
                      </div>
                      <div>
                        <div className="text-brand-400 text-2xl mb-1">✓</div>
                        <p className="text-xs text-dark-300">Ready to Hang</p>
                      </div>
                      <div>
                        <div className="text-brand-400 text-2xl mb-1">✓</div>
                        <p className="text-xs text-dark-300">Archival Inks</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-brand-400 text-2xl mb-1">✓</div>
                        <p className="text-xs text-dark-300">Premium Matte</p>
                      </div>
                      <div>
                        <div className="text-brand-400 text-2xl mb-1">✓</div>
                        <p className="text-xs text-dark-300">Archival Inks</p>
                      </div>
                      <div>
                        <div className="text-brand-400 text-2xl mb-1">✓</div>
                        <p className="text-xs text-dark-300">170gsm Paper</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Image not found link */}
              {imageExists === false && (
                <div className="text-center">
                  <Link href="/gallery" className="text-sm text-brand-400 hover:text-brand-300">
                    ← Select another image from gallery
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* RIGHT COLUMN - Order Configuration */}
          <div className="w-full lg:w-1/2 space-y-6">
            
            {/* SECTION 1: Choose Your Print (Catalog-driven) */}
            <div className="glass-card p-6">
              <h2 className="font-display text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">1</span>
                Choose Your Print
              </h2>
              
              {/* Product Type Tabs */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {supportedTypes.map(type => {
                  const config = PRINT_LAB_CATALOG[type]
                  const isActive = selectedProductType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedProductType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                          : 'text-dark-400 hover:text-white border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {config.icon} {config.title}
                    </button>
                  )
                })}
              </div>
              
              {/* Selected Product Type Description */}
              <div className="mb-6 p-4 rounded-lg bg-dark-800/50 border border-white/5">
                <p className="text-sm text-dark-300">{catalogConfig.shortDescription}</p>
                <ul className="mt-3 space-y-1">
                  {catalogConfig.bullets.map((bullet, i) => (
                    <li key={i} className="text-xs text-dark-400 flex items-center gap-2">
                      <span className="text-brand-400">✓</span> {bullet}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Size Selection Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableSizes.map(sizeOption => {
                  const isSelected = selectedSizeKey === sizeOption.key
                  
                  // Use server-converted price if available, otherwise show GBP (only when no country selected)
                  const convertedPrice = convertedOptions[sizeOption.key]?.price
                  const hasConvertedPrice = convertedPrice !== undefined
                  
                  // Determine display price and currency
                  // If we have converted prices, use them. If not (no country), show GBP.
                  const displayPrice = hasConvertedPrice ? convertedPrice : sizeOption.priceGBP
                  const displayCurrency = hasConvertedPrice ? pricingCurrency : 'GBP'
                  
                  // Show loading state if fetching and we expect non-GBP prices
                  const isLoadingPrice = isFetchingPrices && shippingAddress?.country && !hasConvertedPrice
                  const sizeQuality = sizeQualityMap[sizeOption.key]
                  const isBlockedSize = sizeQuality?.status === 'poor'
                  const qualityBadge = sizeQuality?.status === 'excellent'
                    ? { label: 'Excellent', className: 'bg-green-500/15 text-green-300 border-green-500/30' }
                    : sizeQuality?.status === 'good'
                    ? { label: 'Good', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
                    : sizeQuality?.status === 'warning'
                    ? { label: 'Soft', className: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' }
                    : sizeQuality?.status === 'poor'
                    ? { label: 'Low', className: 'bg-red-500/15 text-red-300 border-red-500/30' }
                    : null
                  
                  return (
                    <button
                      key={sizeOption.key}
                      onClick={() => {
                        if (!isBlockedSize) {
                          setSelectedSizeKey(sizeOption.key)
                        }
                      }}
                      disabled={isBlockedSize}
                      className={`relative p-4 rounded-xl text-left transition-all duration-300 group ${
                        isBlockedSize
                          ? 'bg-dark-800/40 border-2 border-red-500/20 opacity-60 cursor-not-allowed'
                          : 
                        isSelected 
                          ? 'bg-brand-500/20 border-2 border-brand-500 shadow-glow' 
                          : 'bg-dark-800/50 border-2 border-white/10 hover:border-white/20 hover:bg-dark-800'
                      }`}
                    >
                      {/* Selected checkmark */}
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Size */}
                      <div className="text-lg font-bold text-white mb-1">{sizeOption.label}</div>
                      {qualityBadge && (
                        <span className={`inline-flex mb-2 px-2 py-0.5 rounded-md text-[11px] border ${qualityBadge.className}`}>
                          {qualityBadge.label}
                        </span>
                      )}
                      
                      {/* Price - show converted price or loading state */}
                      <div className="text-xl font-bold text-gradient-gold">
                        {isLoadingPrice ? (
                          <span className="inline-block w-16 h-6 bg-dark-700/50 rounded animate-pulse" />
                        ) : (
                          formatPrice(displayPrice, displayCurrency)
                        )}
                      </div>
                      {isBlockedSize && (
                        <p className="mt-1 text-[11px] text-red-300">Choose a smaller size</p>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4">
                <PrintConfidencePanel
                  title="Print confidence by size"
                  subtitle="We prioritize sharper output and block sizes likely to print blurry."
                  sourceWidth={imageDetails?.width}
                  sourceHeight={imageDetails?.height}
                  options={availableSizes.map(option => ({ key: option.key, label: option.label }))}
                  recommendedSizeKey={recommendedSizeKey}
                  compact
                />
              </div>

              {recommendedSizeLabel && (
                <div className="mt-3 rounded-lg border border-brand-500/25 bg-brand-500/10 p-3">
                  <p className="text-sm text-brand-300">
                    Recommended max size for this image: <span className="font-semibold">{recommendedSizeLabel}</span>
                  </p>
                </div>
              )}

              <div className="mt-3 rounded-lg border border-white/10 bg-dark-800/40 p-3">
                <p className="text-xs uppercase tracking-wider text-dark-400">Proof Module</p>
                <p className="mt-1 text-sm text-dark-300">
                  We only let you proceed on size selections that pass print confidence checks for your source image.
                </p>
              </div>
              
              {/* SKU Resolution Error (Guardrail) */}
              {skuError && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {skuError}
                  </p>
                </div>
              )}
            </div>
            
            {/* SECTION 2: Shipping Address */}
            <div className="glass-card p-6">
              <h2 className="font-display text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">2</span>
                Shipping Address
              </h2>
              <ShippingForm
                onChange={setShippingAddress}
                onValidChange={setIsAddressValid}
                onCountryChange={setSelectedCountry}
                initialCountry={selectedCountry}
              />
            </div>
            
            {/* SECTION 3: Delivery Method */}
            {isQuoting ? (
              <div className="glass-card p-6 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mr-3" />
                <span className="text-dark-400">Calculating shipping...</span>
              </div>
            ) : shippingOptions.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="font-display text-xl font-semibold text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Delivery Method
                </h2>
                
                <div className="space-y-3">
                  {shippingOptions.map(method => (
                    <button
                      key={method.uid}
                      type="button"
                      onClick={() => handleShippingMethodSelect(method)}
                      className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                        selectedShippingMethod?.uid === method.uid 
                          ? 'bg-brand-500/20 border-2 border-brand-500' 
                          : 'bg-dark-800/50 border-2 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium text-white">{method.name}</h3>
                          <p className="text-dark-400 text-sm mt-1">
                            {method.minTransitDays}-{method.maxTransitDays} business days
                          </p>
                        </div>
                        <span className="text-lg font-semibold text-brand-400">
                          {formatPrice(method.price, method.currency)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* STICKY ORDER SUMMARY */}
            <div className="glass-card p-6 border-2 border-gold-500/20">
              <h3 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-gold-500">🛒</span> Your Order
              </h3>
              
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              
              {/* Order Line Items */}
              <div className="space-y-3 mb-6">
                {selectedSizeKey && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-dark-300">
                      {catalogConfig.icon} {availableSizes.find(s => s.key === selectedSizeKey)?.label} {catalogConfig.title}
                    </span>
                    <span className="text-white font-medium">
                      {isFetchingPrices && shippingAddress?.country ? (
                        <span className="inline-block w-14 h-4 bg-dark-700/50 rounded animate-pulse" />
                      ) : (
                        formatPrice(productPrice, pricingCurrency)
                      )}
                    </span>
                  </div>
                )}
                
                {selectedShippingMethod ? (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-dark-300">🚚 Shipping ({selectedShippingMethod.name})</span>
                    <span className="text-white font-medium">{formatPrice(shippingPrice, pricingCurrency)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-dark-300">🚚 Shipping</span>
                    <span className="text-dark-500 italic">Enter address</span>
                  </div>
                )}
                
                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-2xl font-bold text-gradient-gold">
                      {isFetchingPrices && shippingAddress?.country ? (
                        <span className="inline-block w-20 h-7 bg-dark-700/50 rounded animate-pulse" />
                      ) : orderTotal > 0 ? (
                        formatPrice(orderTotal, pricingCurrency)
                      ) : '--'}
                    </span>
                  </div>
                  {orderTotal > 0 && !isFetchingPrices && (
                    <p className="text-dark-500 text-xs mt-1 text-right">
                      {pricingCurrency === 'GBP' ? 'Including VAT' : `Converted from £${convertedOptions[selectedSizeKey || '']?.baseGBP?.toFixed(2) || '--'} GBP`}
                    </p>
                  )}
                </div>
              </div>
              
              {/* CTA Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={!resolvedSkuUid || !selectedShippingMethod || !isAddressValid || isPlacingOrder || imageExists === false || isVerifyingImage || !!skuError || isLowQualityForSelectedSize}
                className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed btn-gold shadow-lg hover:shadow-gold-500/30 hover:-translate-y-0.5"
              >
                {isPlacingOrder ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-dark-800/30 border-t-dark-800 rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : imageExists === false ? (
                  'Image Not Available'
                ) : isVerifyingImage ? (
                  'Verifying Image...'
                ) : isLowQualityForSelectedSize ? (
                  'Choose a smaller size for better quality'
                ) : (
                  <>
                    <span>Proceed to Payment</span>
                    <svg className="w-5 h-5 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </>
                )}
              </button>
              
              {/* Trust Badges */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-dark-400">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>256-bit Secure</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-400">VISA</span>
                    <span className="font-bold text-red-400">MC</span>
                    <span className="font-bold text-blue-500">AMEX</span>
                  </div>
                </div>
                
                {/* Quality Guarantee Details */}
                <div className="mt-4 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                      <p className="text-xs text-green-400 font-medium">Quality Guarantee</p>
                      <p className="text-xs text-dark-400 mt-1">
                        If your print arrives damaged or defective, we'll replace it or refund it. Contact us within 30 days with a photo of the issue.
                      </p>
                    </div>
                  </div>
                </div>
                
                <p className="text-center text-dark-500 text-xs mt-3">
                  🌍 Printed locally via Gelato's global network using archival-quality inks
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Zoom Modal */}
      {isZoomed && imageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-dark-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setIsZoomed(false)}
        >
          <img 
            src={imageUrl} 
            alt="Zoomed image"
            className="max-w-full max-h-full object-contain animate-scale-in"
          />
          <button 
            className="absolute top-4 right-4 p-2 bg-dark-800/80 hover:bg-dark-700 rounded-full transition-colors"
            onClick={() => setIsZoomed(false)}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
