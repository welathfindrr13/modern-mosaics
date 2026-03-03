'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

// Error boundary for client components
// See: https://nextjs.org/docs/app/building-your-application/routing/error-handling
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to console for debugging
    console.error('Error caught by error boundary:', error);
  }, [error]);

  const handleReset = () => {
    // Attempt to recover by trying to re-render the segment
    reset();
    // Also refresh the page for a clean state
    router.refresh();
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Something went wrong
        </h2>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 mb-2">
            We encountered an issue while processing your request.
          </p>
          {error.message && (
            <p className="text-sm text-red-600 font-mono overflow-auto max-h-32 bg-red-50 p-2 rounded">
              {error.message}
            </p>
          )}
        </div>
        
        <div className="flex flex-col space-y-3">
          <Button onClick={handleReset} className="bg-blue-600 hover:bg-blue-700">
            Try again
          </Button>
          <Button 
            onClick={() => router.push('/')} 
            variant="outline" 
            className="border-gray-300"
          >
            Return to home
          </Button>
        </div>
      </div>
    </div>
  );
}
