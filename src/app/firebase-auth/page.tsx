'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RedirectPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/signin')
  }, [router])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <p>Redirecting to sign in page...</p>
      </div>
    </div>
  )
}
