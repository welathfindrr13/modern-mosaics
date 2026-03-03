'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { watermarkedPreviewUrl } from '@/utils/gelatoUrls';

/**
 * Test page for Cloudinary image loading
 * This helps diagnose issues with image loading in the application
 */
export default function CloudinaryTestPage() {
  const [cloudName, setCloudName] = useState<string>('');
  const [testImageId, setTestImageId] = useState<string>('sample');
  const [customImageId, setCustomImageId] = useState<string>('');
  const [showCustomTest, setShowCustomTest] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get the Cloudinary cloud name from environment
  useEffect(() => {
    const cn = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    setCloudName(cn || 'not-configured');
  }, []);
  
  // Generate test URLs
  const sampleUrl = `https://res.cloudinary.com/${cloudName}/image/upload/sample`;
  const basicTransformUrl = `https://res.cloudinary.com/${cloudName}/image/upload/c_scale,w_800/sample`;
  const watermarkedUrl = watermarkedPreviewUrl('sample', 'TEST', 'sans_serif');
  const customUrl = showCustomTest ? watermarkedPreviewUrl(customImageId) : '';
  
  // Handle custom image ID test
  const handleCustomTest = () => {
    if (customImageId.trim()) {
      setError(null);
      setShowCustomTest(true);
    } else {
      setError('Please enter an image ID to test');
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Cloudinary Image Test</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-8">
        <h2 className="text-lg font-semibold mb-2">Configuration</h2>
        <p>Cloudinary Cloud Name: <span className="font-mono">{cloudName}</span></p>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Built-in Sample Image Tests</h2>
        <p className="text-gray-600 mb-4">
          These tests use Cloudinary's built-in "sample" image which should be available in all accounts.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Basic Image</h3>
            <div className="aspect-video relative bg-gray-100 mb-3">
              <Image
                src={sampleUrl}
                alt="Basic sample image"
                fill
                className="object-contain"
                onError={() => console.error('Failed to load basic sample image')}
              />
            </div>
            <p className="text-xs mb-2 text-gray-500 break-all">{sampleUrl}</p>
          </div>
          
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">With Basic Transform</h3>
            <div className="aspect-video relative bg-gray-100 mb-3">
              <Image
                src={basicTransformUrl}
                alt="Transform sample image"
                fill
                className="object-contain"
                onError={() => console.error('Failed to load transformed sample image')}
              />
            </div>
            <p className="text-xs mb-2 text-gray-500 break-all">{basicTransformUrl}</p>
          </div>
        </div>
        
        <div className="border rounded-lg p-4 mb-6">
          <h3 className="font-medium mb-2">With App's Watermark Function</h3>
          <div className="aspect-video relative bg-gray-100 mb-3">
            <Image
              src={watermarkedUrl}
              alt="Watermarked sample image"
              fill
              className="object-contain"
              onError={() => console.error('Failed to load watermarked sample image')}
            />
          </div>
          <p className="text-xs mb-2 text-gray-500 break-all">{watermarkedUrl}</p>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Your Custom Image ID</h2>
        <p className="text-gray-600 mb-4">
          Enter your image ID (not the full URL) to test if it can be loaded with the app's watermark function.
        </p>
        
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={customImageId}
            onChange={(e) => setCustomImageId(e.target.value)}
            placeholder="Enter image ID or public_id"
            className="flex-1 border rounded p-2"
          />
          <Button onClick={handleCustomTest}>Test</Button>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {showCustomTest && (
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Custom Image Test</h3>
            <div className="aspect-video relative bg-gray-100 mb-3">
              <Image
                src={customUrl}
                alt="Custom image test"
                fill
                className="object-contain"
                onError={(e) => {
                  console.error('Failed to load custom image:', customImageId);
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22300%22%20height%3D%22400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2245%25%22%20font-family%3D%22Arial%22%20font-size%3D%2220%22%20fill%3D%22%23f00%22%20text-anchor%3D%22middle%22%3EImage%20Load%20Error%3C%2Ftext%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2255%25%22%20font-family%3D%22Arial%22%20font-size%3D%2216%22%20fill%3D%22%23666%22%20text-anchor%3D%22middle%22%3EID%3A%20' + customImageId + '%3C%2Ftext%3E%3C%2Fsvg%3E';
                }}
              />
            </div>
            <p className="text-xs mb-2 text-gray-500 break-all">{customUrl}</p>
            <p className="text-sm mt-2">
              If the image doesn't appear, verify that the image ID is correct and has been uploaded to your Cloudinary account.
            </p>
          </div>
        )}
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Troubleshooting Tips</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Make sure your Cloudinary account is properly set up</li>
          <li>Check that the image exists in your Cloudinary account</li>
          <li>Verify that the image ID is correct (not including any version numbers or prefixes)</li>
          <li>Try accessing the image directly using the raw Cloudinary URL</li>
          <li>Check that you have the correct cloud name in your .env.local file</li>
        </ul>
      </div>
    </div>
  );
}
