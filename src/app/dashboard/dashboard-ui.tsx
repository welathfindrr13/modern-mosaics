'use client'

import { DashboardNav } from './nav'

export function DashboardUI({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      {/* Background effects */}
      <div className="fixed inset-0 bg-glow-gradient opacity-20 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Dashboard header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-dark-400">
            Manage your creations and orders
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Navigation component */}
          <DashboardNav />
          
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
