'use client';

import React, { useState } from 'react';

/**
 * Environment Variable Debugger Component
 * 
 * This component displays information about environment variables
 * that are available to client components. It helps troubleshoot
 * issues with environment variable loading.
 */
export function EnvDebugger() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get all public environment variables
  const publicEnvVars = Object.keys(process.env || {})
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .reduce((acc, key) => {
      acc[key] = process.env[key];
      return acc;
    }, {} as Record<string, any>);
  
  // Highlight the Cloudinary variable
  const cloudinaryVar = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  return (
    <div className="mt-8 p-4 border border-gray-200 rounded-md bg-gray-50">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Environment Debug</h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      <div className="mt-3">
        <div className="mb-2">
          <span className="font-medium">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: </span>
          <code className={`px-2 py-1 rounded ${cloudinaryVar ? 'bg-green-100' : 'bg-red-100'}`}>
            {JSON.stringify(cloudinaryVar)}
          </code>
        </div>
        
        <div className="mb-2">
          <span className="font-medium">Type: </span>
          <code className="px-2 py-1 rounded bg-gray-100">
            {typeof cloudinaryVar}
          </code>
        </div>
        
        <div className="mb-2">
          <span className="font-medium">Is Placeholder: </span>
          <code className={`px-2 py-1 rounded ${cloudinaryVar === 'your-cloud-name-without-quotes' ? 'bg-red-100' : 'bg-green-100'}`}>
            {cloudinaryVar === 'your-cloud-name-without-quotes' ? 'Yes' : 'No'}
          </code>
        </div>
        
        <div className="mb-2">
          <span className="font-medium">Environment: </span>
          <code className="px-2 py-1 rounded bg-gray-100">
            {process.env.NODE_ENV}
          </code>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4">
          <h4 className="text-md font-medium mb-2">All NEXT_PUBLIC_* Variables:</h4>
          <pre className="p-3 bg-gray-100 rounded overflow-auto max-h-48 text-xs">
            {JSON.stringify(publicEnvVars, null, 2)}
          </pre>
          
          <div className="mt-4 text-sm text-gray-700">
            <p className="font-medium">Troubleshooting:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Make sure your <code>.env.local</code> file doesn't have quotes around values</li>
              <li>Restart your Next.js server with <code>npm run dev</code></li>
              <li>Check if there are any duplicate environment variable declarations</li>
              <li>Clear your browser cache or try in an incognito window</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
