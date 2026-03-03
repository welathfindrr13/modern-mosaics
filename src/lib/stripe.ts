/**
 * Stripe Client Library
 * 
 * Provides server-side and client-side Stripe instances for payment processing
 */

import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

/**
 * Server-side Stripe instance for API operations
 * Used in API routes for creating checkout sessions, verifying payments, etc.
 */
export function getServerStripe(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  
  if (!apiKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }
  
  return new Stripe(apiKey, {
    apiVersion: '2025-04-30.basil',
    typescript: true,
  });
}

/**
 * Client-side Stripe instance for frontend operations
 * Used for redirecting to checkout, handling payment elements, etc.
 */
export function getClientStripe() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable');
  }
  
  return loadStripe(publishableKey);
}

/**
 * Utility function to format amount for Stripe (convert to cents)
 * Stripe requires amounts in the smallest currency unit (e.g., cents for USD/GBP)
 */
export function formatAmountForStripe(amount: number, currency: string): number {
  // Most currencies use 2 decimal places (cents)
  // Some currencies like JPY don't use decimal places
  const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'clp'];
  
  if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
    return Math.round(amount);
  }
  
  return Math.round(amount * 100);
}

/**
 * Utility function to format amount from Stripe (convert from cents)
 */
export function formatAmountFromStripe(amount: number, currency: string): number {
  const zeroDecimalCurrencies = ['jpy', 'krw', 'vnd', 'clp'];
  
  if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
    return amount;
  }
  
  return amount / 100;
}
