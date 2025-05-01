import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex justify-center md:justify-start space-x-6">
            <Link href="/" className="text-gray-400 hover:text-gray-500">
              Home
            </Link>
            <Link href="/privacy" className="text-gray-400 hover:text-gray-500">
              Privacy
            </Link>
            <Link href="/terms" className="text-gray-400 hover:text-gray-500">
              Terms
            </Link>
          </div>
          <div className="mt-4 md:mt-0">
            <p className="text-center text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Modern Mosaics. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
