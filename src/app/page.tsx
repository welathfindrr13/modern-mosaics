import React from 'react'
import Link from 'next/link'
import { Button } from '../components/ui/button'

export default function Home() {
  return (
    <div className="py-12 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Transform your photos into</span>
            <span className="block text-blue-600">stunning posters</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Modern Mosaics uses AI to transform your photos into beautiful, high-resolution posters ready for print.
          </p>
          <div className="mt-10 flex justify-center">
            <div className="rounded-md shadow">
              <Link href="/create">
                <Button size="lg">
                  Get Started
                </Button>
              </Link>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link href="/auth/signin">
                <Button variant="outline" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
