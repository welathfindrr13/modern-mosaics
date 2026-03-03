'use client'

import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  className = '',
  hover = true,
  glow = false,
  padding = 'md',
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        glass-card
        ${paddingStyles[padding]}
        ${hover ? 'hover:shadow-xl hover:-translate-y-1' : ''}
        ${glow ? 'shadow-glow' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        transition-all duration-300
        ${className}
      `}
    >
      {children}
    </div>
  )
}

// Metric Card for dashboard stats
interface MetricCardProps {
  icon: React.ReactNode
  value: string | number
  label: string
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function MetricCard({ icon, value, label, trend, className = '' }: MetricCardProps) {
  return (
    <Card className={`${className}`}>
      <div className="flex items-start justify-between">
        <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400">
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend.isPositive 
              ? 'bg-green-500/10 text-green-400' 
              : 'bg-red-500/10 text-red-400'
          }`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-sm text-dark-400 mt-1">{label}</p>
      </div>
    </Card>
  )
}

// Gallery Card for artworks
interface GalleryCardProps {
  image: string
  title: string
  date: string
  onOrder?: () => void
  onPreview?: () => void
  className?: string
}

export function GalleryCard({ 
  image, 
  title, 
  date, 
  onOrder, 
  onPreview,
  className = '' 
}: GalleryCardProps) {
  return (
    <Card padding="none" className={`overflow-hidden group ${className}`}>
      {/* Image Container */}
      <div 
        className="relative aspect-[3/4] overflow-hidden cursor-pointer"
        onClick={onPreview}
      >
        <img 
          src={image} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/90 via-dark-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-3 rounded-full bg-white/10 backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          </div>
          
          {/* Order Button on Hover */}
          {onOrder && (
            <div className="absolute bottom-4 left-4 right-4">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOrder()
                }}
                className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-dark-900 font-semibold rounded-xl shadow-lg hover:shadow-gold-500/40 transition-all"
              >
                Order Print
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Info Section */}
      <div className="p-4">
        <h3 className="font-semibold text-white truncate">{title}</h3>
        <p className="text-sm text-dark-400 mt-1">{date}</p>
      </div>
    </Card>
  )
}

// Skeleton Card for loading states
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <Card padding="none" hover={false} className={`overflow-hidden ${className}`}>
      <div className="aspect-[3/4] bg-dark-700 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-dark-700 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-dark-700 rounded animate-pulse w-1/2" />
      </div>
    </Card>
  )
}


