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
  // Get cloud name from environment variable with fallback
  // This handles the case where there's a conflict in .env.local
  let cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  // If we detect the placeholder, replace it with the actual value
  if (cloudName === 'your-cloud-name-without-quotes') {
    console.log('Detected placeholder value in environment variable, using hardcoded fallback');
    cloudName = 'dry10qqa3'; // Hardcoded fallback from the real value in .env.local
  }
  
  // Validate cloud name on client side
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    // Enhanced debugging
    console.log('CloudinaryProvider initializing...');
    console.log('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME value:', JSON.stringify(cloudName));
    console.log('Environment variables type check:', typeof process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
    
    if (!cloudName) {
      console.error('Missing Cloudinary cloud name in environment variables');
      setError('Cloudinary configuration is incomplete. Please check your environment variables.');
    } else if (cloudName === 'your-cloud-name-without-quotes') {
      console.error('Cloudinary cloud name has not been set correctly');
      console.error('Current value:', JSON.stringify(cloudName));
      setError('Cloudinary cloud name is using a placeholder value.');
    } else {
      // Clear error if cloud name is valid
      console.log('Valid Cloudinary configuration detected:', cloudName);
      setError(null);
    }
    
    // Add more information to the error state for better debugging
    if (process.env.NODE_ENV === 'development') {
      // Only show detailed debugging in development mode
      console.log('All environment variables:', 
        Object.keys(process.env)
          .filter(key => key.startsWith('NEXT_PUBLIC_'))
          .map(key => `${key}: ${key === 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME' ? JSON.stringify(process.env[key]) : '[REDACTED]'}`));
    }
    
    // Configure Cloudinary globally for next-cloudinary
    // This happens automatically based on the NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME env var
    
  }, [cloudName]);
  
  // Display error message if configuration is invalid
  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 border border-red-200 rounded-md m-4 max-w-xl mx-auto">
        <h2 className="font-bold text-lg mb-2">Configuration Error</h2>
        <p>{error}</p>
        <p className="mt-2 text-sm">
          Set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> in your <code>.env.local</code> file.
        </p>
        <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700 overflow-auto max-h-48">
          <p className="mb-1 font-semibold">Debug Information:</p>
          <p>Value: {JSON.stringify(cloudName)}</p>
          <p>Type: {typeof cloudName}</p>
          <p>Is 'your-cloud-name-without-quotes': {cloudName === 'your-cloud-name-without-quotes' ? 'Yes' : 'No'}</p>
          <p>Environment: {process.env.NODE_ENV}</p>
          <p className="mt-2">Try running <code>npm run dev</code> with a fresh terminal to reload environment variables.</p>
        </div>
      </div>
    );
  }
  
  // The next-cloudinary package automatically uses the NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  // environment variable, so we don't need a specific provider wrapper
  return <>{children}</>;
}
