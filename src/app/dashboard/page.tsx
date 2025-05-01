import React from 'react'
import { getCurrentUser } from '../../lib/auth'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Welcome back, {user.name}!
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900">Your Creations</h2>
            <div className="mt-6 grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="group relative bg-gray-100 rounded-lg p-6 flex flex-col items-center justify-center h-64">
                <div className="text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div className="mt-4 text-center">
                  <h3 className="text-sm font-medium text-gray-900">
                    Create New
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
