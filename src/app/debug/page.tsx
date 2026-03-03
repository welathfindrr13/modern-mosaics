'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/firebase-auth-provider';
import { Button } from '@/components/ui/button';

export default function DebugPage() {
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Debug Tools Unavailable</h1>
          <p className="text-gray-600">This page is only available in development.</p>
        </div>
      </div>
    );
  }

  const { user, loading: authLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch debug info from our new endpoint
  const fetchDebugInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/debug', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Debug API returned status ${response.status}`);
      }
      
      const data = await response.json();
      setDebugInfo(data);
    } catch (err: any) {
      console.error('Error fetching debug info:', err);
      setError(err.message || 'An error occurred while fetching debug information');
    } finally {
      setLoading(false);
    }
  };

  // Format JSON for display
  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };
  
  // Handle manual refresh
  const handleRefresh = () => {
    fetchDebugInfo();
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">System Diagnostic</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          {authLoading ? (
            <p>Loading authentication status...</p>
          ) : user ? (
            <div>
              <p className="text-green-600 font-medium">✓ Authenticated</p>
              <p className="mt-2">Email: {user.email}</p>
              <p className="mt-2">User ID: {user.uid}</p>
            </div>
          ) : (
            <p className="text-red-600 font-medium">✗ Not authenticated</p>
          )}
        </div>
      </div>
      
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">API Diagnostics</h2>
          <Button 
            onClick={handleRefresh} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Loading...' : 'Run Diagnostics'}
          </Button>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
            <p>Error: {error}</p>
          </div>
        )}
        
        {debugInfo ? (
          <div className="bg-gray-50 p-4 rounded-lg overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Authentication</h3>
                <div className="bg-white p-3 rounded border">
                  <p>Status: {debugInfo.authentication.status ? '✓ Authenticated' : '✗ Not authenticated'}</p>
                  <p>Email: {debugInfo.authentication.email || 'Not available'}</p>
                  {debugInfo.authentication.folder && (
                    <p>Folder: {debugInfo.authentication.folder}</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Environment Variables</h3>
                <div className="bg-white p-3 rounded border">
                  <p>Cloudinary Cloud Name: {debugInfo.environment.cloudinary.cloudName}</p>
                  <p>Cloudinary API Key: {debugInfo.environment.cloudinary.apiKey}</p>
                  <p>Cloudinary API Secret: {debugInfo.environment.cloudinary.apiSecret}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Cloudinary Status</h3>
                <div className="bg-white p-3 rounded border">
                  <p>Connected: {debugInfo.cloudinary.connected ? '✓ Yes' : '✗ No'}</p>
                  
                  {/* Image Testing Section */}
                  {debugInfo.cloudinary.imageTests && (
                    <div className="mt-3 border-t pt-3">
                      <h4 className="font-medium">Image Testing</h4>
                      <p className="my-1">Sample Image: {debugInfo.cloudinary.imageTests.sampleExists ? 
                        '✓ Found' : '✗ Not Found'}</p>
                      
                      {debugInfo.cloudinary.imageTests.sampleImage && (
                        <div className="mt-2">
                          <p className="text-sm mb-1">Test this URL in your browser:</p>
                          <a 
                            href={debugInfo.cloudinary.imageTests.sampleImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm break-all"
                          >
                            {debugInfo.cloudinary.imageTests.sampleImage}
                          </a>
                          
                          {debugInfo.cloudinary.imageTests.sampleInfo && (
                            <div className="mt-2 text-xs text-gray-600">
                              <p>Format: {debugInfo.cloudinary.imageTests.sampleInfo.format}</p>
                              <p>Dimensions: {debugInfo.cloudinary.imageTests.sampleInfo.width} x {debugInfo.cloudinary.imageTests.sampleInfo.height}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {debugInfo.cloudinary.imageTests.sampleError && (
                        <div className="mt-2 text-red-600 text-sm">
                          <p>Error: {debugInfo.cloudinary.imageTests.sampleError}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {debugInfo.cloudinary.folders && (
                    <div className="mt-2 border-t pt-2">
                      <p>Available folders:</p>
                      <ul className="list-disc list-inside">
                        {debugInfo.cloudinary.folders.map((folder: string) => (
                          <li key={folder}>{folder}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {debugInfo.cloudinary.userFolder && (
                    <div className="mt-2">
                      <p>User folder:</p>
                      {debugInfo.cloudinary.userFolder.exists ? (
                        <p className="text-green-600">✓ Exists with {debugInfo.cloudinary.userFolder.imageCount} images</p>
                      ) : (
                        <p className="text-amber-600">✗ Does not exist yet</p>
                      )}
                    </div>
                  )}
                  
                  {debugInfo.cloudinary.error && (
                    <div className="mt-2 text-red-600">
                      <p>Error: {debugInfo.cloudinary.error}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Cookies</h3>
                <div className="bg-white p-3 rounded border">
                  <pre className="text-xs overflow-auto max-h-40">
                    {formatJson(debugInfo.cookies.values)}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-medium mb-2">Raw Debug Data</h3>
              <pre className="bg-gray-800 text-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                {formatJson(debugInfo)}
              </pre>
            </div>
          </div>
        ) : !loading && (
          <div className="bg-gray-50 p-8 text-center rounded-lg">
            <p>Click "Run Diagnostics" to check system status</p>
          </div>
        )}
      </div>
    </div>
  );
}
