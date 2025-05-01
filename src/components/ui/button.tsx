import React, { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const variantClasses = {
      primary: 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500',
      secondary: 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500',
      outline: 'bg-transparent border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
    }

    const sizeClasses = {
      sm: 'py-1 px-3 text-sm',
      md: 'py-2 px-4 text-base',
      lg: 'py-3 px-6 text-lg',
    }

    return (
      <button
        className={twMerge(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
