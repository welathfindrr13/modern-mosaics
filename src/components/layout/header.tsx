'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Button } from '../ui/button'

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Create', href: '/create' },
    { name: 'Dashboard', href: '/dashboard' },
  ]

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                Modern Mosaics
              </Link>
            </div>
            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center">
            {session ? (
              <div className="flex items-center space-x-4">
                {session.user?.name && (
                  <span className="text-sm text-gray-700">
                    {session.user.name}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <Link href="/auth/signin">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
