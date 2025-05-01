'use client'

import React, { useState, FormEvent } from 'react';
import { Button } from '../../components/ui/button';

export default function CreatePage() {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Generating image with prompt: ${prompt}`);
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Provide more specific error messages based on status code
        if (response.status === 401) {
          throw new Error('Please sign in to generate images');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(data.error || 'Failed to generate image');
        }
      }
      
      setImageUrl(data.imageUrl);
      setRetryCount(0); // Reset retry count on success
    } catch (err: any) {
      console.error('Image generation error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Create Your Mosaic</h1>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label 
            htmlFor="prompt" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Describe the image you want to create
          </label>
          <textarea
            id="prompt"
            rows={4}
            className="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
            placeholder="E.g., A serene mountain landscape with a lake at sunset..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
        </div>
        
        <Button 
          type="submit" 
          disabled={loading || !prompt.trim()}
          className="flex items-center"
        >
          {loading ? (
            <>
              <span className="mr-2">Generating...</span>
              <span className="animate-pulse">⚙️</span>
            </>
          ) : (
            'Generate Image'
          )}
        </Button>
      </form>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <p className="font-medium mb-2">Error: {error}</p>
          <Button 
            onClick={handleRetry}
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={loading || retryCount > 3}
          >
            {loading ? 'Retrying...' : `Retry ${retryCount > 0 ? `(${retryCount}/3)` : ''}`}
          </Button>
          {retryCount > 3 && (
            <p className="text-sm mt-2">Maximum retry attempts reached. Please try a different prompt.</p>
          )}
        </div>
      )}
      
      {imageUrl && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Generated Image</h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <img 
              src={imageUrl} 
              alt="Generated artwork" 
              className="w-full h-auto"
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                setImageUrl(null);
                setPrompt('');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white mr-3"
            >
              Create New Image
            </Button>
            <Button
              onClick={() => window.open(imageUrl, '_blank')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Download Image
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
