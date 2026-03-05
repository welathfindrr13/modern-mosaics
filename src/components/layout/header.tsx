'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/firebase-auth-provider'

export function Header() {
  const { user, logOut, loading } = useAuth()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const hasUser = !!user
  const isGuest = !!user?.isAnonymous
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Account'

  // Track when component has mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Create', href: '/create' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Support', href: '/support' },
  ]

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-dark-900/95 backdrop-blur-xl shadow-lg border-b border-white/5' 
          : 'bg-dark-900/80 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" title="Go to home page" className="flex items-center gap-3 group">
            <div className="relative">
              <img 
                src="/modern-mosaics-logo.png" 
                alt="Modern Mosaics Logo" 
                className="h-11 w-auto transition-transform duration-300 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-brand-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span className="text-xl font-display font-semibold text-white">
              Modern <span className="text-brand-400">Mosaics</span>
            </span>
          </Link>

          {/* Desktop Navigation - Always visible on larger screens */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg hover:bg-white/5 ${
                    isActive
                      ? 'text-white bg-white/5'
                      : 'text-dark-300 hover:text-white'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-brand-400 to-brand-500 rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Auth Section + Mobile Menu */}
          <div className="flex items-center gap-3">
            {/* Only render auth-dependent content after mount to avoid hydration mismatch */}
            {mounted && !loading && hasUser ? (
              <>
                {/* User chip - desktop only */}
                <div className="hidden md:flex items-center gap-3 mr-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm text-dark-200 font-medium">
                    {isGuest ? 'Guest mode' : displayName}
                  </span>
                </div>

                {isGuest && (
                  <Link
                    href="/signin?reason=upgrade"
                    className="hidden md:inline-flex px-4 py-2 text-sm font-medium text-brand-300 border border-brand-400/30 rounded-xl transition-all duration-200 hover:text-brand-200 hover:border-brand-300"
                  >
                    Upgrade account
                  </Link>
                )}

                <button
                  onClick={() => logOut()}
                  className="hidden md:block px-4 py-2 text-sm font-medium text-dark-300 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all duration-200 hover:bg-white/5"
                >
                  Sign out
                </button>
              </>
            ) : mounted && !loading ? (
              <Link 
                href="/signin"
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold rounded-xl hover:from-brand-400 hover:to-brand-500 transition-all duration-200 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-0.5"
              >
                Sign in
              </Link>
            ) : (
              <div className="hidden md:block w-20 h-9 rounded-xl bg-white/5 animate-pulse" />
            )}

            {/* Mobile Menu Button - Only on smaller screens */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-dark-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/5 animate-fade-in">
            <nav className="flex flex-col gap-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-brand-500/10 text-brand-400'
                        : 'text-dark-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
              
              {/* Mobile auth section */}
              <div className="mt-4 pt-4 border-t border-white/5">
                {mounted && !loading && hasUser ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-sm text-dark-200">{isGuest ? 'Guest mode' : displayName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isGuest && (
                        <Link
                          href="/signin?reason=upgrade"
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-3 py-1.5 text-xs border border-brand-400/30 rounded-lg text-brand-300"
                        >
                          Upgrade
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          logOut()
                          setMobileMenuOpen(false)
                        }}
                        className="px-4 py-2 text-sm text-dark-400 hover:text-white"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : mounted && !loading ? (
                  <Link
                    href="/signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-center px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold rounded-xl"
                  >
                    Sign in
                  </Link>
                ) : null}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
