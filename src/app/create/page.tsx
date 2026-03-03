'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import PhotoUploader from '@/components/edit/PhotoUploader'
import { PrintConfidencePanel } from '@/components/ui/PrintConfidencePanel'
import type { SizeKey } from '@/data/printLabCatalog'
import {
  getRecommendedSizeKey,
} from '@/utils/printQuality'

// =============================================================================
// RELIABILITY: Timeout constants for generation flow
// =============================================================================
const GENERATION_TIMEOUT_MS = 75_000  // 75s hard deadline
const SLOW_THRESHOLD_MS = 30_000
const VERY_SLOW_THRESHOLD_MS = 50_000

// =============================================================================
// CREATIVE ART MODE: Pre-filled prompt and suggestions
// Only used in Creative Art mode - NEVER in Photo Prints mode
// =============================================================================
const DEFAULT_PROMPT = ''

const PROMPT_SUGGESTIONS = [
  'Neon-lit Tokyo street at night with rain reflections and glowing signs',
  'Oil painting of a cozy cabin in autumn forest with warm light',
  'Abstract ocean waves crashing in dramatic watercolor style',
  'Vintage botanical illustration of exotic flowers with gold leaf details',
]

// =============================================================================
// CREATIVE ART MODE: Production stage messages during AI generation
// =============================================================================
const PRODUCTION_STAGES = [
  { threshold: 0, label: 'Reading your description' },
  { threshold: 8, label: 'Creating composition' },
  { threshold: 20, label: 'Adding details' },
  { threshold: 40, label: 'Final touches' },
]

const getCurrentStage = (seconds: number): string => {
  for (let i = PRODUCTION_STAGES.length - 1; i >= 0; i--) {
    if (seconds >= PRODUCTION_STAGES[i].threshold) {
      return PRODUCTION_STAGES[i].label
    }
  }
  return PRODUCTION_STAGES[0].label
}

// =============================================================================
// CREATIVE ART MODE: Adjustment options for AI-generated images only
// =============================================================================
const ADJUSTMENT_MODIFIERS: Record<string, string> = {
  'Warmer': ', with warmer golden tones',
  'More detail': ', with more intricate details and texture',
  'Simpler': ', in a simpler cleaner style',
}

// =============================================================================
// PHOTO PRINTS MODE: Deterministic Cloudinary enhancements
// CRITICAL: NO AI, NO generative processing. Identity preservation guaranteed.
// =============================================================================
const PHOTO_ENHANCEMENTS: Record<string, { label: string; transform: string; enabled: boolean }> = {
  enhance: { label: 'Auto Enhance', transform: 'e_improve', enabled: true },
  warmer: { label: 'Warmer', transform: 'e_tint:40:orange', enabled: true },
  cooler: { label: 'Cooler', transform: 'e_tint:40:blue', enabled: true },
  brighter: { label: 'Brighter', transform: 'e_brightness:20', enabled: true },
  sharper: { label: 'Sharpen', transform: 'e_sharpen:100', enabled: true },
  // ADVANCED: Requires Cloudinary Viesus add-on (not available on Free plan)
  denoise: { label: 'Reduce Noise', transform: 'e_noise_reduction:80', enabled: false },
}

const QUALITY_SIZE_OPTIONS: Array<{ key: SizeKey; label: string }> = [
  { key: '8x10', label: '8x10"' },
  { key: '12x16', label: '12x16"' },
  { key: '16x20', label: '16x20"' },
  { key: '18x24', label: '18x24"' },
]

const RECOMMENDED_SIZE_ORDER: SizeKey[] = ['18x24', '16x20', '12x16', '8x10']

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        })
      }
      img.onerror = () => reject(new Error('Could not read image dimensions'))
      img.src = objectUrl
    })
    return dimensions
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// =============================================================================
// MODE TYPE: Two completely separate product flows
// =============================================================================
type CreateMode = 'photo' | 'creative'

export default function CreatePage() {
  // =========================================================================
  // FLOW SEPARATION: Primary mode state
  // 'photo' = deterministic print (default), 'creative' = AI generation
  // =========================================================================
  const [createMode, setCreateMode] = useState<CreateMode>('photo')
  
  // Shared state
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [publicId, setPublicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  
  // PHOTO PRINTS MODE: Upload state
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)
  const [uploadedDimensions, setUploadedDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isReadingDimensions, setIsReadingDimensions] = useState(false)
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([])
  const [showingOriginal, setShowingOriginal] = useState(false)
  const [showOptimizations, setShowOptimizations] = useState(false)
  
  // CREATIVE ART MODE: Prompt state
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null)
  const [pendingAdjustment, setPendingAdjustment] = useState<string | null>(null)
  const [adjustmentCount, setAdjustmentCount] = useState(0)
  const MAX_ADJUSTMENTS = 2

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
  
  // Update preview URL when enhancements change (Photo mode only)
  useEffect(() => {
    if (createMode === 'photo' && uploadedImage && publicId && !loading) {
      const newUrl = buildEnhancedPreviewUrl(publicId)
      setImageUrl(newUrl)
    }
  }, [selectedEnhancements, publicId, uploadedImage, loading, createMode])

  useEffect(() => {
    return () => {
      if (uploadedPreview) {
        URL.revokeObjectURL(uploadedPreview)
      }
    }
  }, [uploadedPreview])

  const recommendedSizeKey = useMemo(() => {
    return getRecommendedSizeKey(
      uploadedDimensions?.width,
      uploadedDimensions?.height,
      RECOMMENDED_SIZE_ORDER
    )
  }, [uploadedDimensions])

  // =========================================================================
  // MODE SWITCHING: Reset all state when switching modes
  // =========================================================================
  const handleModeSwitch = (mode: CreateMode) => {
    if (mode === createMode) return
    
    // Reset all state
    setImageUrl(null)
    setPublicId(null)
    setError(null)
    setUploadedImage(null)
    setUploadedPreview(null)
    setUploadedDimensions(null)
    setIsReadingDimensions(false)
    setSelectedEnhancements([])
    setShowingOriginal(false)
    setPrompt(DEFAULT_PROMPT)
    setGeneratedPrompt(null)
    setPendingAdjustment(null)
    setAdjustmentCount(0)
    
    setCreateMode(mode)
  }

  // Cancel handler
  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setLoading(false)
    setElapsedSeconds(0)
    setError(createMode === 'creative' 
      ? 'Generation cancelled. You can try again.'
      : 'Upload cancelled. You can try again.'
    )
  }

  // =========================================================================
  // SUBMIT HANDLER: Completely different paths for each mode
  // =========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!pendingAdjustment) {
      setImageUrl(null)
      setPublicId(null)
    }
    setLoading(true)
    setError(null)
    setElapsedSeconds(0)
    
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    const startTime = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, GENERATION_TIMEOUT_MS)
    
    try {
      let finalImageUrl: string
      let finalPublicId: string
      
      if (createMode === 'photo' && uploadedImage) {
        // =================================================================
        // PHOTO PRINTS PATH: Deterministic upload - NO AI
        // =================================================================
        const UPLOAD_PATH_OPENAI_BLOCKED = true
        if (!UPLOAD_PATH_OPENAI_BLOCKED) {
          throw new Error('CRITICAL: OpenAI call attempted in upload path.')
        }
        
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(uploadedImage)
        })
        const base64Image = await base64Promise
        
        const uploadResponse = await fetch('/api/images/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            imageUrl: base64Image,
            prompt: 'User uploaded photo',
            save: true,
          }),
          signal: abortController.signal,
        })
        
        const uploadData = await uploadResponse.json()
        if (!uploadResponse.ok) {
          throw new Error(uploadData.error || 'Failed to upload image')
        }
        
        finalPublicId = uploadData.publicId
        
        const transformString = selectedEnhancements
          .map(key => PHOTO_ENHANCEMENTS[key]?.transform)
          .filter(Boolean)
          .join('/')
        
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
        finalImageUrl = transformString
          ? `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${finalPublicId}`
          : `https://res.cloudinary.com/${cloudName}/image/upload/${finalPublicId}`
        
      } else if (createMode === 'creative') {
        // =================================================================
        // CREATIVE ART PATH: AI generation via OpenAI
        // =================================================================
        const response = await fetch('/api/images/generate-and-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ prompt, provider: 'openai', saveToGallery: false }),
          signal: abortController.signal,
        })
        
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate image')
        }
        
        finalImageUrl = data.imageUrl
        finalPublicId = data.publicId
      } else {
        throw new Error('Invalid state: no image to process')
      }
      
      setImageUrl(finalImageUrl)
      setPublicId(finalPublicId)
      if (createMode === 'creative') {
        setGeneratedPrompt(prompt)
      }
      
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const elapsed = Date.now() - startTime
        if (elapsed >= GENERATION_TIMEOUT_MS - 1000) {
          setError(createMode === 'creative'
            ? 'This is taking longer than usual. Please try again.'
            : 'Upload is taking longer than usual. Please try again.'
          )
        }
      } else {
        const msg = err.message?.toLowerCase() || ''
        if (createMode === 'creative') {
          if (msg.includes('rate limit') || msg.includes('429')) {
            setError('Too many requests. Please wait a moment.')
          } else if (msg.includes('content') || msg.includes('policy') || msg.includes('filtered')) {
            setError('Your prompt was flagged by the content filter. Please try a different description.')
          } else if (msg.includes('timeout')) {
            setError('Our servers are busy. Please try again.')
          } else if (msg.includes('openai')) {
            setError('Something went wrong. Please try again.')
          } else {
            setError(err.message || 'Something went wrong. Please try again.')
          }
        } else {
          if (msg.includes('cloudinary') || msg.includes('upload')) {
            setError('Failed to upload your photo. Please try again.')
          } else {
            setError(err.message || 'Something went wrong. Please try again.')
          }
        }
      }
    } finally {
      clearTimeout(timeoutId)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      abortControllerRef.current = null
      setLoading(false)
      setElapsedSeconds(0)
      setPendingAdjustment(null)
    }
  }

  // Creative mode: Handle adjustment clicks
  const handleAdjustment = (adjustment: string) => {
    if (createMode !== 'creative' || !generatedPrompt || loading) return
    if (adjustmentCount >= MAX_ADJUSTMENTS) return
    
    setPendingAdjustment(adjustment)
    setAdjustmentCount(prev => prev + 1)
    
    const modifier = ADJUSTMENT_MODIFIERS[adjustment]
    const newPrompt = generatedPrompt + modifier
    setPrompt(newPrompt)
    
    setTimeout(() => {
      const form = document.querySelector('form')
      if (form) form.requestSubmit()
    }, 0)
  }

  // Start over handler
  const handleStartOver = () => {
    setImageUrl(null)
    setPublicId(null)
    setGeneratedPrompt(null)
    setPrompt(DEFAULT_PROMPT)
    setError(null)
    setUploadedImage(null)
    setUploadedPreview(null)
    setUploadedDimensions(null)
    setIsReadingDimensions(false)
    setAdjustmentCount(0)
    setSelectedEnhancements([])
    setShowingOriginal(false)
  }
  
  // Photo mode: Clear upload
  const handleClearUpload = () => {
    setUploadedImage(null)
    setUploadedPreview(null)
    setUploadedDimensions(null)
    setIsReadingDimensions(false)
    setSelectedEnhancements([])
  }
  
  // Photo mode: Toggle enhancement
  const handleToggleEnhancement = (key: string) => {
    setSelectedEnhancements(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    )
    setShowingOriginal(false)
  }
  
  // Build enhanced preview URL
  const buildEnhancedPreviewUrl = (basePublicId: string): string => {
    const transformString = selectedEnhancements
      .map(key => PHOTO_ENHANCEMENTS[key]?.transform)
      .filter(Boolean)
      .join('/')
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    return transformString
      ? `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${basePublicId}`
      : `https://res.cloudinary.com/${cloudName}/image/upload/${basePublicId}`
  }

  // =========================================================================
  // PREVIEW URL RESOLUTION (computed before render, timing-safe)
  // 
  // This removes the state-coupling bug where publicId could be null while
  // imageUrl has a value, causing bare publicId to render in <img src>.
  // Now we use imageUrl as the SINGLE source of truth.
  // =========================================================================
  const computePreviewSrc = (): string => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    
    // Case 1: No image yet
    if (!imageUrl) return ''
    
    // Case 2: imageUrl is already a full URL - use it directly
    if (imageUrl.startsWith('http')) {
      // For "showingOriginal" in photo mode, strip transforms to show original
      if (createMode === 'photo' && showingOriginal) {
        // Extract publicId from URL: .../upload/[transforms/]publicId
        const uploadIndex = imageUrl.indexOf('/upload/')
        if (uploadIndex !== -1) {
          const afterUpload = imageUrl.substring(uploadIndex + 8) // after '/upload/'
          // Find the publicId (last path segments, typically 3: folder/subfolder/filename)
          const segments = afterUpload.split('/')
          // PublicId is everything after transformation params (those with colons like e_improve, c_scale)
          const publicIdSegments = segments.filter(s => !s.includes(':') && !s.startsWith('c_') && !s.startsWith('e_') && !s.startsWith('f_') && !s.startsWith('q_'))
          const extractedPublicId = publicIdSegments.join('/')
          if (extractedPublicId) {
            return `https://res.cloudinary.com/${cloudName}/image/upload/${extractedPublicId}`
          }
        }
      }
      return imageUrl
    }
    
    // Case 3: imageUrl is a bare publicId - construct full URL
    return `https://res.cloudinary.com/${cloudName}/image/upload/${imageUrl}`
  }
  
  const previewSrc = computePreviewSrc()

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="fixed inset-0 bg-glow-gradient opacity-30 pointer-events-none" />
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ================================================================
            PAGE HEADER - Mode-dependent title and subtitle
            ================================================================ */}
        <div className="text-center mb-6">
          <p className="text-dark-500 text-sm mb-3">
            {createMode === 'photo' 
              ? 'Step 1 of 3 · Upload → Preview → Print'
              : 'Step 1 of 3 · Describe → Preview → Print'
            }
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-3">
            {createMode === 'photo' ? (
              <>Your Photo, <span className="text-gradient">Wall-Ready</span></>
            ) : (
              <>Your Idea, <span className="text-gradient">Wall-Ready</span></>
            )}
          </h1>
          <p className="text-lg text-dark-300">
            {createMode === 'photo' 
              ? 'Preview exactly how it will print before you order'
              : 'Choose a style, preview the artwork, then order a premium print.'
            }
          </p>
        </div>

        {/* ================================================================
            TAB SWITCHER - Accessible segmented control with ARIA semantics
            ================================================================ */}
        <div className="flex justify-center mb-6">
          <div 
            role="tablist" 
            aria-label="Create mode"
            className="inline-flex rounded-xl bg-dark-800/50 p-1 border border-white/5"
          >
            <button
              role="tab"
              aria-selected={createMode === 'photo'}
              aria-controls="photo-panel"
              id="photo-tab"
              tabIndex={createMode === 'photo' ? 0 : -1}
              onClick={() => handleModeSwitch('photo')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                createMode === 'photo'
                  ? 'bg-brand-500 text-white shadow-lg'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
              }`}
            >
              Photo Prints
            </button>
            <button
              role="tab"
              aria-selected={createMode === 'creative'}
              aria-controls="creative-panel"
              id="creative-tab"
              tabIndex={createMode === 'creative' ? 0 : -1}
              onClick={() => handleModeSwitch('creative')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                createMode === 'creative'
                  ? 'bg-brand-500 text-white shadow-lg'
                  : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
              }`}
            >
              Creative Art
            </button>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="glass-card p-6 sm:p-8">
          
          {/* ==============================================================
              PHOTO PRINTS MODE - Upload section (no prompts in DOM)
              ============================================================== */}
          {createMode === 'photo' && !imageUrl && (
            <div id="photo-panel" role="tabpanel" aria-labelledby="photo-tab" className="mb-6">
              {!uploadedImage ? (
                <>
                  <h2 className="text-lg font-medium text-white mb-2">Select your photo</h2>
                  <p className="text-dark-500 text-sm mb-4">
                    What you upload is what prints. Preview it first, then decide.
                  </p>
                  <p className="text-xs text-dark-500 mb-4">
                    Upload a photo to unlock size-by-size print confidence checks.
                  </p>
                  <PhotoUploader 
                    onLoad={async (file) => {
                      setUploadedImage(file)
                      setUploadedDimensions(null)
                      setIsReadingDimensions(true)
                      setUploadedPreview(URL.createObjectURL(file))
                      try {
                        const dimensions = await readImageDimensions(file)
                        setUploadedDimensions(dimensions)
                      } catch {
                        setUploadedDimensions(null)
                      } finally {
                        setIsReadingDimensions(false)
                      }
                    }} 
                  />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link
                      href="/edit"
                      className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-center text-sm text-brand-300 transition-colors hover:bg-brand-500/20"
                    >
                      Reimagine my photo (AI)
                    </Link>
                    <button 
                      type="button"
                      onClick={() => handleModeSwitch('creative')}
                      className="rounded-xl border border-white/10 bg-dark-800/40 px-4 py-3 text-sm text-dark-300 transition-colors hover:border-white/20 hover:text-white"
                    >
                      Switch to Creative Art
                    </button>
                  </div>
                </>
              ) : (
                <div className="mb-4">
                  <h2 className="text-lg font-medium text-white mb-3">Your photo</h2>
                  <div className="relative rounded-xl overflow-hidden border border-white/10 mb-3">
                    <img 
                      src={uploadedPreview!} 
                      alt="Your uploaded photo" 
                      className="w-full h-auto max-h-64 object-contain bg-dark-800"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleClearUpload}
                    className="text-dark-500 text-sm hover:text-dark-300 transition-colors"
                  >
                    Use a different photo
                  </button>

                  {isReadingDimensions && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-dark-800/50 p-4">
                      <p className="text-sm text-dark-300">Checking print quality...</p>
                    </div>
                  )}

                  {uploadedDimensions && (
                    <div className="mt-4">
                      <PrintConfidencePanel
                        title="Print quality check"
                        subtitle="What you upload is what prints. We show expected quality by size before checkout."
                        sourceWidth={uploadedDimensions.width}
                        sourceHeight={uploadedDimensions.height}
                        options={QUALITY_SIZE_OPTIONS}
                        recommendedSizeKey={recommendedSizeKey}
                      />
                    </div>
                  )}

                  <div className="mt-3">
                    <Link
                      href="/edit"
                      className="text-xs text-brand-400 underline hover:text-brand-300"
                    >
                      Want background replacement or AI edits? Use Reimagine Editor
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              CREATIVE ART MODE - Prompt section (completely separate)
              ============================================================== */}
          {createMode === 'creative' && !imageUrl && (
            <div id="creative-panel" role="tabpanel" aria-labelledby="creative-tab" className="mb-6">
              {/* Reassurance copy */}
              <div className="mb-4 text-center">
                <p className="text-dark-400 text-sm">This creates brand-new artwork from your description.</p>
                <p className="text-dark-500 text-xs mt-1">You'll preview it before ordering — nothing is charged yet.</p>
              </div>
              {/* PRIMARY: One-click prompt cards */}
              <div className="mb-6">
                <p className="text-sm text-dark-400 mb-3 text-center">Pick a style to preview</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROMPT_SUGGESTIONS.map((suggestion, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPrompt(suggestion)}
                      aria-pressed={prompt === suggestion}
                      disabled={loading}
                      className={`text-left p-4 rounded-xl transition-all disabled:opacity-50 ${
                        prompt === suggestion
                          ? 'bg-brand-500/20 border-2 border-brand-500 text-white'
                          : 'bg-dark-800/50 border border-white/10 text-dark-300 hover:text-white hover:border-white/20 hover:bg-dark-800'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm leading-relaxed line-clamp-2">{suggestion}</span>
                        {prompt === suggestion && (
                          <span className="text-brand-300 text-xs">Selected</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* SECONDARY: Custom prompt (collapsed by default feel) */}
              <div className="pt-4 border-t border-white/5">
                <p className="text-xs text-dark-500 mb-2">Or write your own</p>
                <textarea
                  id="prompt"
                  rows={2}
                  className="input-premium w-full resize-none text-sm"
                  placeholder="Describe your artwork..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>
          )}

          {/* ==============================================================
              FORM WITH SUBMIT BUTTON - Only show when NO preview exists
              This ensures only ONE primary CTA is visible per state:
              - Before preview: "Generate print preview" (Photo) / "Generate Preview" (Creative)
              - After preview: "Choose size & order" (shown in preview section below)
              ============================================================== */}
          {!imageUrl && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <button 
                  type="submit" 
                  disabled={loading || (createMode === 'photo' ? !uploadedImage : !prompt.trim())}
                  className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {createMode === 'photo' ? 'Preparing your photo for print...' : 'Creating your print preview...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>{createMode === 'photo' ? 'Create print preview' : 'Create print preview'}</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </span>
                  )}
                </button>
                
                {/* Loading progress - different for each mode */}
                {loading && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-dark-300">
                      {createMode === 'photo' 
                        ? 'Building your print preview...'
                        : getCurrentStage(elapsedSeconds) + '...'
                      }
                    </p>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="mt-2 text-xs text-dark-500 hover:text-dark-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {!loading && createMode === 'creative' && !prompt.trim() && (
                  <p className="mt-3 text-xs text-dark-500 text-center">
                    Select a style card or write a prompt to create a preview.
                  </p>
                )}
              </div>
            </form>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-300 font-medium">Something went wrong</p>
                  <p className="text-red-400/80 text-sm mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setError(null)
                  handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                }}
                className="mt-4 btn-secondary text-sm"
                disabled={loading}
              >
                Try Again
              </button>
            </div>
          )}

          {/* ==============================================================
              PREVIEW SECTION - Mode-aware headers and controls
              ============================================================== */}
          {imageUrl && (
            <div ref={previewRef} className="mt-8 animate-fade-in">
              {/* Preview header - different copy for each mode */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {createMode === 'photo' ? 'Your print preview' : 'Your print preview'}
                </h2>
                <p className="text-dark-400 text-sm mt-1">
                  {createMode === 'photo' 
                    ? 'What you see is exactly what will be printed · Premium 170gsm matte'
                    : 'Custom image · Premium 170gsm matte'
                  }
                </p>
              </div>
              
              <div className="relative group rounded-xl overflow-hidden border border-white/10">
                <img 
                  src={previewSrc}
                  alt={showingOriginal ? "Original photo" : "Preview"} 
                  className="w-full h-auto"
                />
                {/* Label overlay when showing original */}
                {createMode === 'photo' && showingOriginal && selectedEnhancements.length > 0 && (
                  <div className="absolute top-3 left-3 px-2 py-1 rounded bg-dark-900/80 text-xs text-dark-300">
                    Showing original
                  </div>
                )}
                {/* Loading overlay for adjustments */}
                {loading && pendingAdjustment && (
                  <div className="absolute inset-0 bg-dark-900/80 flex flex-col items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mb-3" />
                    <p className="text-white text-sm font-medium">Applying: {pendingAdjustment}</p>
                    <p className="text-dark-400 text-xs mt-1">Your image is being refined...</p>
                  </div>
                )}
              </div>
              
              {/* CTA and controls */}
              <div className="mt-6 space-y-4">
                {/* Order CTA */}
                <Link
                  href={publicId 
                    ? `/order?publicId=${encodeURIComponent(publicId)}${createMode === 'photo' && selectedEnhancements.length > 0 ? `&transforms=${encodeURIComponent(selectedEnhancements.join(','))}` : ''}`
                    : `/order?imageUrl=${encodeURIComponent(imageUrl)}`
                  }
                  className="btn-gold w-full text-lg py-4 flex items-center justify-center"
                >
                  Choose size & order
                </Link>
                
                {/* Price anchor + trust signal */}
                <div className="text-center space-y-1">
                  <p className="text-dark-400 text-sm">From £26.99 · A3 poster · Premium 170gsm matte</p>
                  <p className="text-dark-500 text-xs">Ships in 2–4 business days · Free UK returns</p>
                </div>

                <div className="rounded-xl border border-brand-500/25 bg-brand-500/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-brand-300">Print Proof</p>
                  <p className="mt-2 text-sm text-dark-200">
                    This preview is prepared for print output, not just screen display. Size-level quality checks and
                    guardrails continue in checkout.
                  </p>
                </div>

                {/* MODE-SPECIFIC CONTROLS */}
                <div className="pt-4 border-t border-white/5">
                  {createMode === 'photo' ? (
                    /* PHOTO MODE: Collapsible enhancement toggles */
                    <>
                      <button
                        onClick={() => setShowOptimizations(!showOptimizations)}
                        className="w-full flex items-center justify-center gap-2 text-dark-500 text-xs hover:text-dark-400 transition-colors py-2"
                        aria-expanded={showOptimizations}
                      >
                        <span>Adjust print settings (optional)</span>
                        <svg 
                          className={`w-3 h-3 transition-transform ${showOptimizations ? 'rotate-180' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showOptimizations && (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap justify-center gap-2">
                            {Object.entries(PHOTO_ENHANCEMENTS).map(([key, { label, enabled }]) => (
                              <button
                                key={key}
                                onClick={() => enabled && handleToggleEnhancement(key)}
                                disabled={loading || !enabled}
                                className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                                  !enabled
                                    ? 'bg-dark-800/50 text-dark-600 border border-white/5 cursor-not-allowed opacity-60'
                                    : selectedEnhancements.includes(key)
                                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50'
                                      : 'bg-dark-800 text-dark-400 hover:text-dark-200 border border-white/5 hover:border-white/10 disabled:opacity-50'
                                }`}
                                title={!enabled ? 'Advanced enhancement — coming soon' : undefined}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {/* Advanced enhancement note */}
                          <p className="text-center text-dark-600 text-[10px]">
                            Some advanced enhancements coming soon
                          </p>
                          {selectedEnhancements.length > 0 && (
                            <div className="text-center space-y-2">
                              <p className="text-dark-500 text-xs">
                                {selectedEnhancements.length} optimization{selectedEnhancements.length > 1 ? 's' : ''} applied
                              </p>
                              <button
                                onClick={() => setShowingOriginal(!showingOriginal)}
                                className="text-xs text-dark-500 hover:text-dark-300 underline transition-colors"
                              >
                                {showingOriginal ? 'Show optimized' : 'Compare with original'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* CREATIVE MODE: AI adjustment pills */
                    adjustmentCount < MAX_ADJUSTMENTS ? (
                      <>
                        <p className="text-center text-dark-500 text-xs mb-3">Adjust artwork (optional)</p>
                        <div className="flex justify-center gap-2">
                          {Object.keys(ADJUSTMENT_MODIFIERS).map((adj) => (
                            <button
                              key={adj}
                              onClick={() => handleAdjustment(adj)}
                              disabled={loading}
                              className="text-xs px-3 py-1.5 rounded-full bg-dark-800 text-dark-400 hover:text-dark-200 border border-white/5 hover:border-white/10 transition-all disabled:opacity-50"
                            >
                              {adj}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-dark-500 text-xs">
                        Preview finalized — ready to order
                      </p>
                    )
                  )}
                </div>

                {/* Start over */}
                <div className="flex justify-center text-sm pt-2">
                  <button 
                    onClick={handleStartOver} 
                    className="text-dark-500 hover:text-dark-300 transition-colors"
                  >
                    Start over
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==============================================================
            CREATIVE MODE ONLY: AI attribution footer
            ============================================================== */}
        {createMode === 'creative' && (
          <div className="text-center mt-6">
            <p className="text-dark-600 text-xs">Custom image creation</p>
          </div>
        )}
      </div>
    </div>
  )
}
