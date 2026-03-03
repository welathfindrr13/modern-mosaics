import React from 'react'
import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import '../styles/globals.css'
import { FirebaseAuthProvider } from '../components/providers/firebase-auth-provider'
import { CloudinaryProvider } from '../components/providers/cloudinary-provider'
import { Header } from '../components/layout/header'
import { Footer } from '../components/layout/footer'

// Premium fonts
const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Modern Mosaics | Premium Photo & Art Prints',
  description: 'Premium photo prints and custom artwork, delivered to your door. Museum-quality printing with worldwide shipping.',
  applicationName: 'Modern Mosaics',
  authors: [{ name: 'Modern Mosaics Team' }],
  keywords: ['photo prints', 'poster', 'printing', 'art', 'canvas', 'wall art', 'custom prints'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="min-h-screen flex flex-col bg-dark-900 text-dark-50 font-sans antialiased">
        <FirebaseAuthProvider>
          <CloudinaryProvider>
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </CloudinaryProvider>
        </FirebaseAuthProvider>
      </body>
    </html>
  )
}
