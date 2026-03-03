'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RedirectPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/signin')
  }, [router])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="flex items-center gap-3 text-dark-400">
        <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <span>Redirecting...</span>
      </div>
    </div>
  )
}
