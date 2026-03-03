'use client';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function Spinner({ size = 'medium', className = '' }: SpinnerProps) {
  const sizeClasses = {
    small: 'w-4 h-4 border-2',
    medium: 'w-8 h-8 border-3',
    large: 'w-12 h-12 border-4'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} inline-block rounded-full border-gray-300 border-t-blue-600 animate-spin`} 
         role="status" 
         aria-label="Loading">
      <span className="sr-only">Loading...</span>
    </div>
  );
}
