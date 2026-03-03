'use client'

import React, { useEffect, useCallback } from 'react'
import { Button } from './button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  className?: string
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  className = '',
}: ModalProps) {
  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-dark-950/95 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className={`
          relative w-full ${modalSizes[size]}
          bg-dark-800/95 backdrop-blur-xl
          border border-white/10 rounded-2xl
          shadow-2xl shadow-dark-950/50
          animate-scale-in
          ${className}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            {title && (
              <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors ml-auto"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        
        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// Image Preview Modal
interface ImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  title?: string
  date?: string
  onOrder?: () => void
}

export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  title,
  date,
  onOrder,
}: ImagePreviewModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-dark-950/98 backdrop-blur-xl animate-fade-in cursor-zoom-out"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col lg:flex-row gap-6 animate-scale-in">
        {/* Image */}
        <div className="flex-1 flex items-center justify-center">
          <img 
            src={imageUrl} 
            alt={title || 'Preview'}
            className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
        
        {/* Info Panel */}
        <div className="lg:w-80 glass-card p-6 space-y-4">
          {title && (
            <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
          )}
          {date && (
            <p className="text-dark-400 text-sm">Created {date}</p>
          )}
          
          <div className="pt-4 border-t border-white/10 space-y-3">
            {onOrder && (
              <Button variant="gold" fullWidth onClick={onOrder}>
                Order Print
              </Button>
            )}
            <Button variant="secondary" fullWidth onClick={onClose}>
              Close
            </Button>
          </div>
          
          <p className="text-dark-500 text-xs text-center">
            Press ESC or click outside to close
          </p>
        </div>
      </div>
      
      {/* Close button - top right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-dark-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

