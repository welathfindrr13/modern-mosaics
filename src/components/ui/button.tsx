'use client'

import React from 'react'
import Link from 'next/link'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  href?: string
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
  children: React.ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-brand-500 to-brand-600 
    text-white font-semibold 
    shadow-lg shadow-brand-500/25 
    hover:from-brand-400 hover:to-brand-500 
    hover:shadow-brand-500/40 hover:-translate-y-0.5
    active:translate-y-0
  `,
  secondary: `
    bg-transparent 
    border-2 border-white/20 
    text-white font-medium 
    hover:border-white/40 hover:bg-white/5
    active:bg-white/10
  `,
  outline: `
    bg-transparent 
    border-2 border-white/20 
    text-white font-medium 
    hover:border-white/40 hover:bg-white/5
    active:bg-white/10
  `,
  ghost: `
    bg-transparent 
    text-dark-300 
    hover:text-white hover:bg-white/5
    active:bg-white/10
  `,
  gold: `
    bg-gradient-to-r from-gold-500 to-gold-600 
    text-dark-900 font-semibold 
    shadow-lg shadow-gold-500/25 
    hover:from-gold-400 hover:to-gold-500 
    hover:shadow-gold-500/40 hover:-translate-y-0.5
    active:translate-y-0
  `,
  danger: `
    bg-red-500/10 
    border border-red-500/30 
    text-red-400 font-medium 
    hover:bg-red-500/20 hover:border-red-500/50
    active:bg-red-500/30
  `,
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    ${variants[variant]}
    ${sizes[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `

  const content = (
    <>
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle 
            className="opacity-25" 
            cx="12" cy="12" r="10" 
            stroke="currentColor" 
            strokeWidth="4" 
            fill="none" 
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
          />
        </svg>
      ) : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={baseStyles}>
        {content}
      </Link>
    )
  }

  return (
    <button 
      className={baseStyles} 
      disabled={disabled || isLoading}
      {...props}
    >
      {content}
    </button>
  )
}

// Arrow icon component for CTAs
export function ArrowRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}
