'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Footer() {
  const currentYear = new Date().getFullYear()
  const pathname = usePathname()

  const links = [
    { name: 'Home', href: '/' },
    { name: 'Create', href: '/create' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Support', href: '/support' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
  ]

  return (
    <footer className="relative bg-dark-900 border-t border-white/5">
      <div className="absolute inset-0 bg-gradient-to-t from-dark-950 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-10 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:items-center">
            <div className="text-center md:text-left">
              <Link href="/" className="inline-flex items-center gap-3 group">
                <img
                  src="/modern-mosaics-logo.png"
                  alt="Modern Mosaics Logo"
                  className="h-10 w-auto opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <span className="text-lg font-display font-semibold text-dark-200 group-hover:text-white transition-colors">
                  Modern <span className="text-brand-400">Mosaics</span>
                </span>
              </Link>
              <p className="mt-3 text-sm text-dark-400 max-w-xs mx-auto md:mx-0">
                Premium photo prints and custom artwork, delivered with secure checkout and tracked fulfillment.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 justify-items-center md:justify-items-center">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className={`text-sm transition-colors duration-200 ${
                    pathname === link.href ? 'text-brand-400' : 'text-dark-400 hover:text-brand-400'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="text-center md:text-right space-y-1">
              <p className="text-sm text-dark-400">Support: support@modernmosaics.co</p>
              <p className="text-xs text-dark-500">Typically responds within one business day</p>
              <p className="text-xs text-dark-600 pt-2">&copy; {currentYear} Modern Mosaics</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 text-xs text-dark-500 text-center sm:text-left">
            <p>Secure checkout via Stripe</p>
            <p>Fulfillment via Gelato</p>
            <p>Tracked worldwide shipping</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
