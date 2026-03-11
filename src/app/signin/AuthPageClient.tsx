'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import { useAuth } from '@/components/providers/firebase-auth-provider'
import { 
  signInWithGoogle, 
  signInWithEmailPassword, 
  createUserWithEmailPassword,
  signInAnonymously,
  sendPasswordResetEmailLink,
  getGoogleRedirectAuthResult,
} from '@/lib/firebase'
import { clientCookieUtils } from '@/lib/auth-cookies'
import { getSigninReasonMessage, isMethodDisabled, type AuthMethod } from '@/lib/auth-flow'
import { trackClientEvent } from '@/lib/client-telemetry'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()
  const [activeAuthMethod, setActiveAuthMethod] = useState<AuthMethod>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const authAttemptRef = useRef(0)

  const signInReason = getSigninReasonMessage(searchParams?.get('reason'))
  const isGoogleLoading = activeAuthMethod === 'google'
  const isGuestLoading = activeAuthMethod === 'guest'
  const isEmailLoading = activeAuthMethod === 'email'

  const beginAuthAttempt = (method: Exclude<AuthMethod, null>): number => {
    authAttemptRef.current += 1
    const attemptId = authAttemptRef.current
    setActiveAuthMethod(method)
    setError(null)
    setInfo(null)
    return attemptId
  }

  const isStaleAttempt = (attemptId: number) => authAttemptRef.current !== attemptId

  const finishAuthAttempt = (attemptId: number) => {
    if (!isStaleAttempt(attemptId)) {
      setActiveAuthMethod(null)
    }
  }

  useEffect(() => {
    if (loading || !user || user.isAnonymous) {
      return
    }

    void completeAuthNavigation(user, '/dashboard')
  }, [loading, user])

  useEffect(() => {
    let cancelled = false

    const consumeRedirectResult = async () => {
      const result = await getGoogleRedirectAuthResult()
      if (cancelled || !result.error) {
        return
      }

      setActiveAuthMethod(null)
      const authErrorCode = 'code' in result.error ? result.error.code : null
      void trackClientEvent('sign_in_google_failed', {
        reason: result.code || 'unknown',
        authErrorCode,
        authErrorMessage: result.error.message,
        phase: 'redirect_result',
      })

      switch (result.code) {
        case 'unauthorized_domain':
          setError('Google sign-in is not authorized for this domain yet.')
          break
        case 'operation_not_supported':
          setError('Google sign-in is not supported in this browser configuration.')
          break
        default:
          setError('Failed to sign in with Google. Please try again.')
      }
    }

    void consumeRedirectResult()

    return () => {
      cancelled = true
    }
  }, [])

  const completeAuthNavigation = async (user: User, destination: '/dashboard' | '/create') => {
    // Ensure auth cookies exist before navigating to server-guarded routes.
    await clientCookieUtils.setAuthCookie(user)
    router.replace(destination)
    router.refresh()
  }
  
  const handleGoogleSignIn = async () => {
    const attemptId = beginAuthAttempt('google')
    try {
      const result = await signInWithGoogle()
      if (isStaleAttempt(attemptId)) return

      if (result.error) {
        const authErrorCode = 'code' in result.error ? result.error.code : null
        void trackClientEvent('sign_in_google_failed', {
          reason: result.code || 'unknown',
          timedOut: result.timedOut === true,
          authErrorCode,
          authErrorMessage: result.error.message,
          phase: 'start',
        })

        switch (result.code) {
          case 'popup_blocked':
            setError('Please allow popups for this site and try again.')
            break
          case 'popup_closed':
            setError('Sign-in was cancelled. Please try again.')
            break
          case 'popup_timeout':
            setError('Google sign-in timed out. Please close any popup windows and retry.')
            break
          case 'popup_cancelled':
            setError('A previous Google sign-in request was cancelled. Please try again.')
            break
          case 'unauthorized_domain':
            setError('Google sign-in is not authorized for this domain yet.')
            break
          case 'operation_not_supported':
            setError('Google sign-in is not supported in this browser configuration.')
            break
          default:
            setError('Failed to sign in with Google. Please try again.')
        }
      } else if (result.user) {
        void trackClientEvent('sign_in_google_succeeded')
        await completeAuthNavigation(result.user, '/dashboard')
      } else if (result.code === 'redirect_started') {
        setInfo('Redirecting to Google...')
      }
    } catch {
      if (isStaleAttempt(attemptId)) return
      void trackClientEvent('sign_in_google_failed', {
        reason: 'unexpected_error',
        timedOut: false,
      })
      setError('An unexpected error occurred. Please try again.')
    } finally {
      finishAuthAttempt(attemptId)
    }
  }

  const handleGuestCheckout = async () => {
    const attemptId = beginAuthAttempt('guest')

    try {
      const result = await signInAnonymously()
      if (isStaleAttempt(attemptId)) return

      if (result.error) {
        setError('Guest checkout is currently unavailable. Please try again.')
      } else if (result.user) {
        await completeAuthNavigation(result.user, '/create')
      }
    } catch {
      if (isStaleAttempt(attemptId)) return
      setError('Guest checkout is currently unavailable. Please try again.')
    } finally {
      finishAuthAttempt(attemptId)
    }
  }
  
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    
    const attemptId = beginAuthAttempt('email')
    
    try {
      if (mode === 'signin') {
        const result = await signInWithEmailPassword(email, password)
        if (isStaleAttempt(attemptId)) return

        if (result.error) {
          setError('Invalid email or password. Please try again.')
        } else if (result.user) {
          await completeAuthNavigation(result.user, '/dashboard')
        }
      } else {
        const result = await createUserWithEmailPassword(email, password)
        if (isStaleAttempt(attemptId)) return

        if (result.error) {
          if (result.code === 'email_already_in_use') {
            setError('This email is already registered. Please try signing in.')
          } else if (result.code === 'weak_password') {
            setError('Password is too weak. Please use a stronger password.')
          } else {
            setError('Failed to create account. Please try again.')
          }
        } else if (result.user) {
          await completeAuthNavigation(result.user, '/dashboard')
        }
      }
    } catch {
      if (isStaleAttempt(attemptId)) return
      setError('An unexpected error occurred')
    } finally {
      finishAuthAttempt(attemptId)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then click "Forgot password?".')
      return
    }

    const result = await sendPasswordResetEmailLink(email)
    if (result.success) {
      setError(null)
      setInfo('Password reset email sent. Please check your inbox.')
      return
    }

    if (result.code === 'invalid_credentials') {
      setInfo('If an account exists for that email, a reset link has been sent.')
      setError(null)
      return
    }

    setError('Unable to send reset email right now. Please try again.')
  }
  
  return (
    <div className="min-h-screen bg-dark-900 flex items-start justify-center px-4 pt-28 pb-12 sm:items-center sm:py-12">
      {/* Background effects */}
      <div className="fixed inset-0 bg-glow-gradient opacity-30 pointer-events-none" />
      <div className="fixed top-20 left-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
      
      <div className="relative w-full max-w-md">
        {/* Auth Card */}
        <div className="glass-card p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white text-center mb-2">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-dark-400 text-center mb-6 sm:mb-8 text-base sm:text-lg">
            {mode === 'signin' 
              ? 'Sign in to continue creating' 
              : 'Start your creative journey'}
          </p>

          {signInReason && (
            <div className="mb-6 p-4 rounded-xl bg-brand-500/10 border border-brand-500/30">
              <p className="text-brand-200 text-sm">{signInReason}</p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {info && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-green-300 text-sm">{info}</p>
            </div>
          )}
          
          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isMethodDisabled(activeAuthMethod, 'google')}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white text-dark-800 font-medium hover:bg-dark-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isGoogleLoading ? (
              <div className="w-5 h-5 border-2 border-dark-400 border-t-dark-800 rounded-full animate-spin" />
            ) : (
              <Image src="/google-icon.svg" alt="Google" width={20} height={20} />
            )}
            {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <button
            onClick={handleGuestCheckout}
            disabled={isMethodDisabled(activeAuthMethod, 'guest')}
            className="w-full px-6 py-3 rounded-xl border border-white/15 text-dark-200 hover:text-white hover:border-white/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isGuestLoading ? 'Starting guest session...' : 'Continue as Guest'}
          </button>
          
          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-dark-800 text-dark-500">or continue with email</span>
            </div>
          </div>
          
          {/* Email Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isEmailLoading}
                className="input-premium"
                placeholder="you@example.com"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isEmailLoading}
                className="input-premium"
                placeholder="••••••••"
                required
              />
              {mode === 'signin' && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-brand-300 hover:text-brand-200 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
            
            <button
              type="submit"
              disabled={isMethodDisabled(activeAuthMethod, 'email')}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {isEmailLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
          
          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button 
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              disabled={isEmailLoading}
              className="text-sm text-dark-400 hover:text-brand-400 transition-colors"
            >
              {mode === 'signin' 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"}
            </button>
          </div>
          
          {/* Account clarity */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-xs text-dark-500 text-center">
              Sign in is required to keep your gallery and orders private.
            </p>
          </div>
        </div>
        
        {/* Back to home */}
        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-dark-500 hover:text-dark-300 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
