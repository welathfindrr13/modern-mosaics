'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { 
    name: 'Overview', 
    href: '/dashboard', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ) 
  },
  { 
    name: 'Orders', 
    href: '/dashboard/orders', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ) 
  }
]

export function DashboardNav() {
  const pathname = usePathname() || '/dashboard'
  
  return (
    <>
      {/* Sidebar navigation - visible on lg+ screens */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <nav className="glass-card p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname && pathname.startsWith(`${item.href}/`))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-dark-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-brand-400' : 'text-dark-500 group-hover:text-dark-300'}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        {/* Quick actions */}
        <div className="mt-6 glass-card p-4">
          <p className="text-xs text-dark-500 uppercase tracking-wider mb-3">Quick Actions</p>
          <div className="space-y-2">
            <Link 
              href="/create" 
              className="flex items-center gap-2 text-sm text-dark-300 hover:text-brand-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Artwork
            </Link>
            <Link 
              href="/gallery" 
              className="flex items-center gap-2 text-sm text-dark-300 hover:text-brand-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              View Gallery
            </Link>
          </div>
        </div>
      </div>
      
      {/* Mobile tabs navigation */}
      <div className="lg:hidden mb-6">
        <div className="glass-card p-1 flex gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname && pathname.startsWith(`${item.href}/`))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-dark-400 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
