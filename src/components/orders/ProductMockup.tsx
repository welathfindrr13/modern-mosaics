'use client'

import { useState, useEffect } from 'react'

type ProductType = 'poster' | 'canvas' | 'fine-art'

interface ProductMockupProps {
  imageUrl: string | null
  productUid?: string
  isLoading?: boolean
  imageExists?: boolean | null
}

function getProductType(productUid?: string): ProductType {
  if (!productUid) return 'poster'
  if (productUid.startsWith('canvas_')) return 'canvas'
  if (productUid.includes('archival') || productUid.includes('fine-art')) return 'fine-art'
  return 'poster'
}

function getProductSize(productUid?: string): string {
  if (!productUid) return '16×20"'
  if (productUid.includes('8x10')) return '8×10"'
  if (productUid.includes('12x16')) return '12×16"'
  if (productUid.includes('16x20')) return '16×20"'
  if (productUid.includes('18x24')) return '18×24"'
  if (productUid.includes('24x36')) return '24×36"'
  return '16×20"'
}

function getProductLabel(type: ProductType): string {
  switch (type) {
    case 'canvas': return 'Gallery Canvas'
    case 'fine-art': return 'Fine Art Print'
    default: return 'Premium Poster'
  }
}

export default function ProductMockup({ 
  imageUrl, 
  productUid, 
  isLoading = false,
  imageExists = null 
}: ProductMockupProps) {
  const [productType, setProductType] = useState<ProductType>('poster')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  // NOTE: Removed fake 'activeView' state (Framed/Room/Detail toggles) - they were cosmetic only
  
  useEffect(() => {
    const newType = getProductType(productUid)
    if (newType !== productType) {
      setIsTransitioning(true)
      setTimeout(() => {
        setProductType(newType)
        setIsTransitioning(false)
      }, 150)
    }
  }, [productUid, productType])
  
  const size = getProductSize(productUid)
  
  // Loading state
  if (isLoading) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="aspect-[4/5] flex items-center justify-center bg-dark-800">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-dark-400">Preparing your artwork...</p>
          </div>
        </div>
      </div>
    )
  }
  
  // Image not found
  if (imageExists === false) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="aspect-[4/5] flex items-center justify-center bg-dark-800 border border-red-500/20">
          <div className="text-center p-6">
            <span className="text-6xl mb-4 block">😕</span>
            <p className="text-red-400 font-medium mb-2">Image Not Found</p>
            <p className="text-dark-500 text-sm">Please select another image from your gallery</p>
          </div>
        </div>
      </div>
    )
  }
  
  // No image yet
  if (!imageUrl) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="aspect-[4/5] flex items-center justify-center bg-dark-800">
          <div className="w-10 h-10 border-2 border-dark-600 border-t-dark-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="glass-card overflow-hidden">
        {/* Product Label Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {productType === 'canvas' ? '🖼️' : productType === 'fine-art' ? '🎨' : '📄'}
            </span>
            <div>
              <h3 className="font-medium text-white">{getProductLabel(productType)}</h3>
              <p className="text-sm text-dark-400">{size}</p>
            </div>
          </div>
          {imageExists === true && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ready to Print
            </span>
          )}
        </div>
        
        {/* Main Mockup Display */}
        <div 
          className="relative aspect-[4/5] cursor-zoom-in group"
          onClick={() => setIsZoomed(true)}
        >
          {/* Wall/Room Background */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, #1a1a24 0%, #15151d 60%, #0f0f14 100%)'
            }}
          >
            {/* Subtle wall texture */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
              }}
            />
            
            {/* Spotlight effect */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 30%, rgba(45, 122, 140, 0.1) 0%, transparent 50%)'
              }}
            />
          </div>
          
          {/* The Frame/Print */}
          <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-12">
            <div 
              className={`relative w-full max-w-[80%] transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
              style={{
                transform: productType === 'canvas' ? 'perspective(1000px) rotateY(-2deg)' : 'none'
              }}
            >
              {/* Frame Shadow */}
              <div 
                className="absolute -inset-4 rounded-sm"
                style={{
                  boxShadow: productType === 'canvas' 
                    ? '12px 16px 40px rgba(0,0,0,0.6), 6px 8px 20px rgba(0,0,0,0.4)'
                    : '8px 12px 35px rgba(0,0,0,0.5), 4px 6px 15px rgba(0,0,0,0.3)'
                }}
              />
              
              {/* Canvas depth effect */}
              {productType === 'canvas' && (
                <>
                  <div className="absolute -left-4 top-2 bottom-2 w-4 bg-gradient-to-r from-dark-600 to-dark-500 transform skew-y-12 rounded-l-sm" />
                  <div className="absolute -right-4 top-2 bottom-2 w-4 bg-gradient-to-l from-dark-700 to-dark-600 transform -skew-y-12 rounded-r-sm" />
                  <div className="absolute -top-4 left-2 right-2 h-4 bg-gradient-to-b from-dark-500 to-dark-600 transform skew-x-12 rounded-t-sm" />
                </>
              )}
              
              {/* Poster/Fine art mat border */}
              {productType === 'poster' && (
                <div className="absolute -inset-2 bg-white/95 rounded-sm shadow-inner" />
              )}
              {productType === 'fine-art' && (
                <div className="absolute -inset-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-sm shadow-inner" />
              )}
              
              {/* The Image */}
              <div className={`relative aspect-[3/4] overflow-hidden ${productType === 'fine-art' ? 'rounded-none' : 'rounded-sm'}`}>
                <img
                  src={imageUrl}
                  alt="Your artwork preview"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.svg'
                  }}
                />
                
                {/* Canvas texture overlay */}
                {productType === 'canvas' && (
                  <div 
                    className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='canvas'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23canvas)'/%3E%3C/svg%3E")`
                    }}
                  />
                )}
                
                {/* Paper texture for fine art */}
                {productType === 'fine-art' && (
                  <div 
                    className="absolute inset-0 opacity-8 pointer-events-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)'/%3E%3C/svg%3E")`
                    }}
                  />
                )}
                
                {/* Subtle gloss/reflection */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 100%)'
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Floor shadow */}
          <div 
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-8"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, transparent 70%)',
              filter: 'blur(8px)'
            }}
          />
          
          {/* Zoom hint on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/0 group-hover:bg-dark-900/30 transition-colors duration-300 pointer-events-none">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-sm font-medium flex items-center gap-2 bg-dark-800/80 px-4 py-2 rounded-full backdrop-blur-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              Click to zoom
            </div>
          </div>
        </div>
        
        {/* NOTE: Removed fake "View as: Framed/In Room/Detail" toggles - they were cosmetic only */}
      </div>
      
      {/* Fullscreen Zoom Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-50 bg-dark-950/98 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh]">
            <img 
              src={imageUrl} 
              alt="Zoomed artwork"
              className="w-full h-full object-contain animate-scale-in rounded-lg shadow-2xl"
            />
            
            {/* Close button */}
            <button 
              className="absolute -top-12 right-0 p-2 text-dark-400 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setIsZoomed(false)
              }}
            >
              <span className="text-sm mr-2">Press ESC or click anywhere to close</span>
              <svg className="w-6 h-6 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
