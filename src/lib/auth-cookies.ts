import { User } from 'firebase/auth'

const AUTH_COOKIE_NAME = 'auth-session'
const USER_EMAIL_COOKIE = 'user-email'
const ID_TOKEN_COOKIE = 'firebase-id-token'
const COOKIE_EXPIRES_DAYS = 1 // ID tokens expire after 1 hour, but refresh automatically

// Client-side cookie utilities
export const clientCookieUtils = {
  // Set cookie when user is authenticated (client-side only)
  setAuthCookie: async (user: User) => {
    if (typeof window === 'undefined') return

    const Cookies = require('js-cookie')
    
    try {
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      
      // Store the Firebase ID token for server-side verification
      Cookies.set(ID_TOKEN_COOKIE, idToken, {
        expires: COOKIE_EXPIRES_DAYS,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      })
      
      // Keep legacy auth cookie for backward compatibility
      Cookies.set(AUTH_COOKIE_NAME, 'authenticated', {
        expires: COOKIE_EXPIRES_DAYS,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      })
      
      // Also store the user's email for API routes that need it
      if (user.email) {
        Cookies.set(USER_EMAIL_COOKIE, user.email, {
          expires: COOKIE_EXPIRES_DAYS,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        })
      }
    } catch (error) {
      console.error('Failed to get ID token:', error);
      // Fallback to basic authentication
      Cookies.set(AUTH_COOKIE_NAME, 'authenticated', {
        expires: COOKIE_EXPIRES_DAYS,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      })
    }
  },

  // Remove cookie when user logs out (client-side only)
  removeAuthCookie: () => {
    if (typeof window === 'undefined') return

    const Cookies = require('js-cookie')
    Cookies.remove(AUTH_COOKIE_NAME)
    Cookies.remove(USER_EMAIL_COOKIE)
    Cookies.remove(ID_TOKEN_COOKIE)
  },

  // Check if auth cookie exists (client-side only)
  hasAuthCookie: (): boolean => {
    if (typeof window === 'undefined') return false

    const Cookies = require('js-cookie')
    return !!Cookies.get(AUTH_COOKIE_NAME)
  },

  // Get the user's email from the cookie (client-side only)
  getUserEmailFromCookie: (): string | null => {
    if (typeof window === 'undefined') return null

    const Cookies = require('js-cookie')
    return Cookies.get(USER_EMAIL_COOKIE) || null
  }
}

// Server-side cookie utilities for API routes
export const serverCookieUtils = {
  // Get user email from request cookies (server-side only)
  getUserEmailFromRequest: (request: Request): string | null => {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return null

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = decodeURIComponent(value)
      return acc
    }, {} as Record<string, string>)

    return cookies[USER_EMAIL_COOKIE] || null
  },

  // Check if user is authenticated from request cookies (server-side only)
  isAuthenticatedFromRequest: (request: Request): boolean => {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return false

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = decodeURIComponent(value)
      return acc
    }, {} as Record<string, string>)

    return cookies[AUTH_COOKIE_NAME] === 'authenticated'
  }
}

// Legacy exports for backward compatibility (client-side only)
export const setAuthCookie = clientCookieUtils.setAuthCookie
export const removeAuthCookie = clientCookieUtils.removeAuthCookie
export const hasAuthCookie = clientCookieUtils.hasAuthCookie
export const getUserEmailFromCookie = clientCookieUtils.getUserEmailFromCookie
