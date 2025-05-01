import React from 'react'
import type { Metadata } from 'next'
import '../styles/globals.css'
import { AuthProvider } from '../components/providers/session-provider'
import { Header } from '../components/layout/header'
import { Footer } from '../components/layout/footer'

export const metadata: Metadata = {
  title: 'Modern Mosaics',
  description: 'AI-powered photo-to-poster app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
