'use client'

import React from 'react'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { Button } from '../../../components/ui/button'

export default function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Welcome to Modern Mosaics</h1>
        <p className="mb-6 text-gray-600">
          Sign in to create and order beautiful AI-generated poster art
        </p>
        
        <Button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full flex items-center justify-center gap-2"
        >
          <Image 
            src="/google-icon.svg" 
            alt="Google" 
            width={20} 
            height={20} 
          />
          Sign in with Google
        </Button>
      </div>
    </div>
  )
}
