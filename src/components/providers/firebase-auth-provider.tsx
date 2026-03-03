'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from 'firebase/auth'
import { onAuthStateChange, signInWithGoogle, signOut } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { clientCookieUtils } from '@/lib/auth-cookies'
import { userOperations } from '@/utils/firestore-client'

// Define the auth context type
type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: () => Promise<{ user: User | null; error: any }>
  logOut: () => Promise<{ error: any }>
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => ({ user: null, error: new Error('Not implemented') }),
  logOut: async () => ({ error: new Error('Not implemented') }),
})

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext)

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Set up the auth state listener when the component mounts
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (authUser) => {
      if (authUser) {
        // User is signed in
        setUser(authUser)
        // Set auth cookie for middleware
        await clientCookieUtils.setAuthCookie(authUser)
        
        // Create/update user document in Firestore using Firebase UID
        // Skip profile creation for anonymous users.
        if (!authUser.isAnonymous && authUser.email) {
          try {
            await userOperations.createIfNotExists(authUser.uid, {
              email: authUser.email,
              firebaseUid: authUser.uid,
              displayName: authUser.displayName || authUser.email?.split('@')[0] || 'User',
              photoURL: authUser.photoURL || undefined,
              preferences: {
                currency: 'GBP',
                notifications: true
              }
            });
          } catch (error) {
            // Continue anyway - authentication was successful
            console.error('Failed to create user document in Firestore:', error);
          }
        }
      } else {
        // User is signed out
        setUser(null)
        // Remove auth cookie
        clientCookieUtils.removeAuthCookie()
      }
      setLoading(false)
    })

    // Clean up the listener when the component unmounts
    return () => unsubscribe()
  }, [])

  // Set up automatic token refresh
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout

    const setupTokenRefresh = (authUser: User) => {
      // Clear any existing interval
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }

      // Refresh token every 45 minutes (tokens expire after 1 hour)
      refreshInterval = setInterval(async () => {
        try {
          await authUser.getIdToken(true) // Force refresh
          
          // Update the cookie with the fresh token
          await clientCookieUtils.setAuthCookie(authUser)
        } catch (error) {
          console.error('Failed to refresh Firebase ID token:', error)
        }
      }, 45 * 60 * 1000) // 45 minutes
    }

    // Set up token refresh when user changes
    const unsubscribe = onAuthStateChange((authUser) => {
      if (authUser) {
        setupTokenRefresh(authUser)
      } else {
        // Clear refresh interval when user logs out
        if (refreshInterval) {
          clearInterval(refreshInterval)
        }
      }
    })

    return () => {
      unsubscribe()
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [])

  // Sign in with Google
  const handleSignIn = async () => {
    const result = await signInWithGoogle()
    if (result.user) {
      router.push('/dashboard')
    }
    return result
  }

  // Sign out
  const handleLogOut = async () => {
    const result = await signOut()
    if (!result.error) {
      router.push('/signin')
    }
    return result
  }

  const value = {
    user,
    loading,
    signIn: handleSignIn,
    logOut: handleLogOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
