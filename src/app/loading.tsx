'use client';

import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="min-h-[70vh] w-full flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <Spinner size="large" className="mb-4" />
        <h2 className="text-xl font-medium text-gray-700">Loading...</h2>
        <p className="text-gray-500 mt-2">
          Preparing your content, this may take a moment.
        </p>
      </div>
    </div>
  );
}
