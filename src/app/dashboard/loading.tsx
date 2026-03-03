'use client';

import { Spinner } from '@/components/ui/spinner';

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Skeleton for creations section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="h-7 w-40 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden shadow">
              {/* Skeleton image */}
              <div className="aspect-square bg-gray-200 animate-pulse"></div>
              {/* Skeleton content */}
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton for orders section */}
      <div>
        <div className="h-7 w-32 bg-gray-200 rounded mb-4 animate-pulse"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-36 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded-full animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Fallback spinner */}
      <div className="flex justify-center my-8">
        <Spinner size="large" />
      </div>
    </div>
  );
}
