'use client'

import React from 'react'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  highlight?: string
  align?: 'left' | 'center' | 'right'
  size?: 'sm' | 'md' | 'lg'
  badge?: string
  action?: React.ReactNode
  className?: string
}

const alignments = {
  left: 'text-left',
  center: 'text-center mx-auto',
  right: 'text-right ml-auto',
}

const sizes = {
  sm: {
    title: 'text-2xl md:text-3xl',
    subtitle: 'text-base',
    maxWidth: 'max-w-xl',
  },
  md: {
    title: 'text-3xl md:text-4xl',
    subtitle: 'text-lg',
    maxWidth: 'max-w-2xl',
  },
  lg: {
    title: 'text-4xl md:text-5xl',
    subtitle: 'text-xl',
    maxWidth: 'max-w-3xl',
  },
}

export function SectionHeader({
  title,
  subtitle,
  highlight,
  align = 'center',
  size = 'md',
  badge,
  action,
  className = '',
}: SectionHeaderProps) {
  const sizeStyles = sizes[size]
  
  // Split title at highlight word
  const renderTitle = () => {
    if (!highlight) {
      return <span>{title}</span>
    }
    
    const parts = title.split(highlight)
    return (
      <>
        {parts[0]}
        <span className="text-gradient">{highlight}</span>
        {parts[1]}
      </>
    )
  }

  return (
    <div className={`${alignments[align]} ${sizeStyles.maxWidth} ${className}`}>
      {/* Badge */}
      {badge && (
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dark-800/80 border border-white/10 mb-4 ${
          align === 'center' ? 'mx-auto' : ''
        }`}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-dark-200">{badge}</span>
        </div>
      )}
      
      {/* Title with optional action */}
      <div className={`flex items-center gap-4 ${
        align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
      }`}>
        <h2 className={`font-display font-bold text-white ${sizeStyles.title}`}>
          {renderTitle()}
        </h2>
        {action}
      </div>
      
      {/* Subtitle */}
      {subtitle && (
        <p className={`text-dark-400 mt-4 ${sizeStyles.subtitle}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// Divider component for sections
export function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`relative py-12 ${className}`}>
      <div className="absolute left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-500 shadow-glow" />
    </div>
  )
}


