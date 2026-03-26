'use client';

import React from 'react';

/**
 * CloudinaryProvider - Provides Cloudinary configuration globally
 * 
 * This component validates the Cloudinary configuration and shows
 * an error message if it's not properly set up.
 */
export function CloudinaryProvider({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  const isPlaceholder = cloudName === 'your-cloud-name-without-quotes';
  const isConfigured = Boolean(cloudName) && !isPlaceholder;
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (!isConfigured) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Cloudinary configuration is incomplete or using a placeholder value.');
      }
      setError('Image services are temporarily unavailable.');
    } else {
      setError(null);
    }
  }, [isConfigured]);
  
  if (error && process.env.NODE_ENV !== 'production') {
    return (
      <div className="p-4 text-red-500 bg-red-50 border border-red-200 rounded-md m-4 max-w-xl mx-auto">
        <h2 className="font-bold text-lg mb-2">Configuration Error</h2>
        <p>{error}</p>
        <p className="mt-2 text-sm">
          Set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> in your <code>.env.local</code> file.
        </p>
      </div>
    );
  }
  
  return <>{children}</>;
}
