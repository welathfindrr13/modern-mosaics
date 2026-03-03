'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/firebase-auth-provider'
import { CldImage } from 'next-cloudinary'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ImagePreviewModal } from '@/components/ui/Modal'

interface GalleryImage {
  id: string           // Firestore document ID (used for deletion)
  publicId: string     // Cloudinary publicId
  secureUrl: string
  prompt: string
  createdAt: string
}

type SortOption = 'newest' | 'oldest' | 'a-z'

// Confirmation dialog component
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  title,
  message,
  confirmText = 'Remove',
  errorMessage,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  title: string
  message: string
  confirmText?: string
  errorMessage?: string | null
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm"
        onClick={!isLoading ? onClose : undefined}
      />
      
      {/* Dialog */}
      <div className="relative bg-dark-800 rounded-2xl p-6 max-w-sm w-full mx-4 border border-white/10 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-dark-400 text-sm mb-6">{message}</p>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{errorMessage}</p>
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-dark-700 text-dark-200 hover:bg-dark-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Skeleton card for loading states and empty grid slots
function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="aspect-square bg-dark-700" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-dark-700 rounded w-3/4" />
        <div className="h-3 bg-dark-700 rounded w-1/2" />
      </div>
    </div>
  )
}

export default function GalleryPage() {
  const { user, loading: authLoading } = useAuth()
  const isAuthenticated = !!user && !user.isAnonymous
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  
  // Delete state
  const [imageToDelete, setImageToDelete] = useState<GalleryImage | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Handle image deletion
  const handleDeleteImage = async () => {
    if (!imageToDelete) return
    
    setIsDeleting(true)
    setDeleteError(null)
    
    // Optimistically remove from local state
    const previousImages = [...images]
    setImages(prev => prev.filter(img => img.id !== imageToDelete.id))
    
    try {
      const response = await fetch(`/api/images/${imageToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Restore images on error
        setImages(previousImages)
        
        if (data.error === 'IMAGE_IN_USE') {
          setDeleteError("This image is linked to an order and can't be removed.")
        } else {
          setDeleteError(data.message || "Couldn't remove image. Please try again.")
        }
        return
      }
      
      // Success - close dialog
      setImageToDelete(null)
    } catch (err: any) {
      // Restore images on error
      setImages(previousImages)
      setDeleteError("Couldn't remove image. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteDialog = (image: GalleryImage, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening the preview modal
    setDeleteError(null)
    setImageToDelete(image)
  }

  const closeDeleteDialog = () => {
    if (!isDeleting) {
      setImageToDelete(null)
      setDeleteError(null)
    }
  }

  useEffect(() => {
    async function fetchImages() {
      if (!isAuthenticated) return
      
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/images/gallery', {
          credentials: 'include'
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch your images')
        }
        
        const data = await response.json()
        setImages(data.images || [])
      } catch (err: any) {
        console.error('Error fetching gallery images:', err)
        setError(err.message || 'Failed to load your gallery')
      } finally {
        setLoading(false)
      }
    }
    
    if (isAuthenticated) {
      fetchImages()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [isAuthenticated, authLoading])

  // Sort images based on selected option
  const sortedImages = useMemo(() => {
    const sorted = [...images]
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'a-z':
        return sorted.sort((a, b) => (a.prompt || '').localeCompare(b.prompt || ''))
      default:
        return sorted
    }
  }, [images, sortBy])

  // Calculate how many skeleton cards to show to fill the grid (minimum 3 columns)
  const skeletonCount = Math.max(0, 3 - images.length)

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header skeleton */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-10 w-48 bg-dark-700 rounded animate-pulse mb-2" />
              <div className="h-5 w-24 bg-dark-700 rounded animate-pulse" />
            </div>
            <div className="h-11 w-32 bg-dark-700 rounded-xl animate-pulse" />
          </div>
          
          {/* Grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  // Not signed in
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="fixed inset-0 bg-glow-gradient opacity-30 pointer-events-none" />
        <div className="relative max-w-2xl mx-auto px-4 text-center py-20">
          <div className="glass-card p-12">
            <span className="text-6xl mb-6 block">🖼️</span>
            <h1 className="font-display text-3xl font-bold text-white mb-4">Private Gallery</h1>
            <p className="text-lg text-dark-300 mb-8">
              Sign in to view your own saved images and order prints.
            </p>
            <Link href="/signin" className="btn-primary">
              Sign In to Continue
            </Link>
          </div>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-card p-8 max-w-xl mx-auto text-center">
            <span className="text-4xl mb-4 block">⚠️</span>
            <h2 className="text-xl font-semibold text-white mb-2">Failed to load gallery</h2>
            <p className="text-dark-400 mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      {/* Background effects */}
      <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl font-bold text-white">
              Your <span className="text-gradient">Gallery</span>
            </h1>
            <p className="text-dark-400 mt-2">
              {images.length} {images.length === 1 ? 'creation' : 'creations'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            {images.length > 0 && (
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-dark-800 text-dark-200 text-sm px-4 py-2.5 pr-10 rounded-xl border border-white/10 hover:border-white/20 focus:border-brand-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="a-z">A–Z (Prompt)</option>
                </select>
                <svg 
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
            
            <Link href="/create" className="btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New
            </Link>
          </div>
        </div>
        
        {/* Empty state */}
        {images.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <span className="text-6xl mb-6 block">✨</span>
            <h2 className="text-2xl font-semibold text-white mb-3">No creations yet</h2>
            <p className="text-dark-400 mb-8 max-w-md mx-auto">
              Start creating beautiful AI-generated artwork and save your favorites here
            </p>
            <Link href="/create" className="btn-gold">
              Create Your First Artwork
            </Link>
            
            {/* Skeleton preview to show what it will look like */}
            <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto opacity-30">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="aspect-square bg-dark-700 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          /* Image grid - Always 3 columns on lg+ */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedImages.map((image, index) => (
              <div 
                key={image.publicId} 
                className="group glass-card overflow-hidden cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => setSelectedImage(image)}
              >
                <div className="aspect-square relative overflow-hidden">
                  <ErrorBoundary fallback={
                    <div className="w-full h-full flex items-center justify-center bg-dark-800">
                      <div className="text-center p-4">
                        <span className="text-3xl mb-2 block">🖼️</span>
                        <p className="text-dark-400 text-sm">Failed to load</p>
                      </div>
                    </div>
                  }>
                    <CldImage
                      width={600}
                      height={600}
                      src={image.publicId}
                      alt={image.prompt || "Generated image"}
                      crop="fill"
                      gravity="auto"
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </ErrorBoundary>
                  
                  {/* Delete button - top right corner */}
                  <button
                    onClick={(e) => openDeleteDialog(image, e)}
                    className="absolute top-2 right-2 p-2 bg-dark-900/60 hover:bg-red-500/80 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                    aria-label="Remove image from gallery"
                    title="Remove from gallery"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                    
                  {/* Action buttons at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex gap-2">
                      <Link
                        href={`/order?imageUrl=${encodeURIComponent(image.secureUrl)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 btn-gold text-sm py-2 text-center"
                      >
                        Order Print
                      </Link>
                      <a
                        href={image.secureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        title="Download"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <p className="text-sm text-dark-200 line-clamp-2 mb-2">
                    {image.prompt || "No prompt available"}
                  </p>
                  <p className="text-xs text-dark-500">
                    {new Date(image.createdAt).toLocaleDateString('en-GB', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Fill remaining slots with skeleton cards to maintain 3-column minimum */}
            {images.length > 0 && images.length < 3 && (
              [...Array(skeletonCount)].map((_, i) => (
                <div key={`skeleton-${i}`} className="glass-card overflow-hidden opacity-30">
                  <div className="aspect-square bg-dark-700 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-dark-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <p className="text-dark-600 text-sm">More coming soon</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="h-4 bg-dark-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-dark-700 rounded w-1/2" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <ImagePreviewModal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          imageUrl={selectedImage.secureUrl}
          title={selectedImage.prompt || "Your Artwork"}
          date={new Date(selectedImage.createdAt).toLocaleDateString('en-GB', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
          onOrder={() => {
            window.location.href = `/order?imageUrl=${encodeURIComponent(selectedImage.secureUrl)}`
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!imageToDelete}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteImage}
        isLoading={isDeleting}
        title="Remove from gallery?"
        message="This won't affect any past orders."
        confirmText="Remove"
        errorMessage={deleteError}
      />
    </div>
  )
}
