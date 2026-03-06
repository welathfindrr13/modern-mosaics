'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../components/providers/firebase-auth-provider'

const howItWorks = [
  {
    step: '01',
    title: 'Upload',
    description: 'Start with your real photo or artwork. We keep the flow focused on print readiness, not gimmicks.',
    icon: '📷',
  },
  {
    step: '02',
    title: 'Check Quality',
    description: 'See your recommended print size before paying, with DPI guidance and crop-safe previewing.',
    icon: '🖼️',
  },
  {
    step: '03',
    title: 'Print & Deliver',
    description: 'Pay securely with Stripe and send the order to Gelato for tracked global fulfillment.',
    icon: '📦',
  },
]

const features = [
  { icon: '🧪', title: 'DPI Confidence', desc: 'Size-by-size quality status before payment so buyers avoid blurry outputs.' },
  { icon: '🛡️', title: 'Size Guardrails', desc: 'Low-quality size selections are blocked with a safer recommended size.' },
  { icon: '⚙️', title: 'Deterministic Edits', desc: 'Photo enhancement stays consistent and focused on print prep.' },
  { icon: '🌍', title: 'Reliable Fulfillment', desc: 'Stripe checkout and Gelato production with tracked delivery support.' },
]

const proofChecks = [
  {
    title: 'Preview before payment',
    body: 'Buyers see framing and print suitability before checkout instead of hoping the final print works.',
  },
  {
    title: 'Real support path',
    body: 'Support, privacy, and cancellation details are visible before purchase and linked in the flow.',
  },
  {
    title: 'Known fulfillment partners',
    body: 'Checkout is handled by Stripe and production runs through Gelato with tracked shipping updates.',
  },
]

const pricingFeatures = [
  'Archival paper or canvas',
  'Sizes up to 18×24"',
  'Fade-resistant inks',
  'Tracked worldwide shipping',
]

export default function Home() {
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (loading || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="relative">
          <div
            className="w-16 h-16 border-2 border-brand-500/30 rounded-full animate-spin"
            style={{ borderTopColor: 'var(--color-brand)' }}
          />
          <div
            className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-gold-500/50 rounded-full animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-900 overflow-hidden">
      <section className="relative min-h-[92vh] md:min-h-screen flex items-center">
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 bg-glow-gradient opacity-40 md:opacity-50" />
        <div className="absolute top-16 left-0 w-48 h-48 md:w-72 md:h-72 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-12 right-0 w-56 h-56 md:w-96 md:h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 md:pt-32 pb-14 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/6 border border-white/10 mb-5 sm:mb-7 animate-fade-in">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm text-dark-200">Print-first photo and art workflow</span>
              </div>

              <h1 className="font-display text-[2.5rem] leading-[0.95] sm:text-6xl lg:text-7xl font-bold animate-fade-in-up">
                Prints that feel
                <span className="block text-gradient mt-2">worth ordering</span>
              </h1>

              <p className="mt-5 text-base sm:text-xl text-dark-200 max-w-xl mx-auto lg:mx-0 animate-fade-in-up stagger-1">
                Clear sizing, proof-before-payment, and tracked fulfillment. No surprise crops. No vague quality promises.
              </p>

              <div className="mt-3 text-sm text-dark-400 max-w-xl mx-auto lg:mx-0 animate-fade-in-up stagger-1">
                Secure checkout via Stripe. Fulfillment via Gelato. Support replies within one business day.
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center lg:justify-start animate-fade-in-up stagger-2">
                {user ? (
                  <Link href="/create" className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4">
                    Start Creating
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                ) : (
                  <Link href="/signin" className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4">
                    Get Started Free
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                )}
                <a href="#how-it-works" className="btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4">
                  See How It Works
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-sm text-dark-300 animate-fade-in-up stagger-3">
                <span>From £26.99</span>
                <span className="hidden sm:inline text-dark-600">•</span>
                <span>Tracked worldwide shipping</span>
                <span className="hidden sm:inline text-dark-600">•</span>
                <Link href="/support" className="text-brand-300 hover:text-brand-200 transition-colors">
                  Support & cancellation policy
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="glass-card p-4 sm:p-5 shadow-card max-w-md mx-auto lg:max-w-none">
                <div className="rounded-2xl border border-white/10 bg-dark-950/80 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div>
                      <p className="text-sm font-semibold text-white">Order proof system</p>
                      <p className="text-xs text-dark-400">What buyers see before they pay</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                      Ready for print
                    </span>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-dark-800 border border-white/8">
                      <Image
                        src="/modern-mosaics-logo.png"
                        alt="Modern Mosaics print proof preview"
                        width={720}
                        height={900}
                        className="w-full h-full object-contain p-10 opacity-90"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="rounded-2xl bg-white/4 border border-white/10 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Checkout</p>
                        <p className="mt-1 text-sm font-medium text-white">Stripe</p>
                      </div>
                      <div className="rounded-2xl bg-white/4 border border-white/10 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Fulfillment</p>
                        <p className="mt-1 text-sm font-medium text-white">Gelato</p>
                      </div>
                      <div className="rounded-2xl bg-white/4 border border-white/10 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Support</p>
                        <p className="mt-1 text-sm font-medium text-white">1 business day</p>
                      </div>
                      <div className="rounded-2xl bg-white/4 border border-white/10 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Preview</p>
                        <p className="mt-1 text-sm font-medium text-white">Before checkout</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative py-16 sm:py-24 bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-brand-400 text-xs sm:text-sm font-medium uppercase tracking-wider">How It Works</span>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl font-bold text-white">
              Proof Before <span className="text-gradient">Print</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-dark-300 max-w-2xl mx-auto">
              The flow is built to reduce bad surprises, not just push users into checkout.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-8">
            {howItWorks.map((item) => (
              <div key={item.step} className="group relative glass-card p-6 sm:p-8 hover:border-brand-500/30 transition-all duration-300">
                <div className="absolute -top-4 -left-1 sm:-left-4 w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white font-bold shadow-glow">
                  {item.step}
                </div>
                <div className="mt-4">
                  <span className="text-3xl sm:text-4xl mb-4 block">{item.icon}</span>
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">{item.title}</h3>
                  <p className="text-sm sm:text-base text-dark-300">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 bg-dark-900">
        <div className="absolute inset-0 bg-glow-gradient opacity-25" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-gold-500 text-xs sm:text-sm font-medium uppercase tracking-wider">Print Proof System</span>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl font-bold text-white">
              Built for <span className="text-gradient-gold">Output Quality</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="text-center p-5 sm:p-6 rounded-2xl bg-dark-800/60 border border-white/6 hover:border-brand-500/20 transition-colors">
                <span className="text-3xl sm:text-4xl mb-4 block">{feature.icon}</span>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-dark-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-dark-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-brand-400 text-xs sm:text-sm font-medium uppercase tracking-wider">Trust Signals</span>
            <h2 className="mt-4 font-display text-3xl sm:text-5xl font-bold text-white">
              Before You Pay, You Can Check the Basics
            </h2>
            <p className="mt-4 text-base sm:text-lg text-dark-300 max-w-2xl mx-auto">
              This is a storefront, not a mystery box. The information you need is visible early.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {proofChecks.map((item) => (
              <div key={item.title} className="glass-card p-6 sm:p-7">
                <div className="inline-flex items-center rounded-full border border-brand-400/25 bg-brand-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
                  Checked
                </div>
                <h3 className="mt-4 text-lg sm:text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm sm:text-base text-dark-300">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-dark-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-gold-500 text-xs sm:text-sm font-medium uppercase tracking-wider">Pricing</span>
          <h2 className="mt-4 font-display text-3xl sm:text-5xl font-bold text-white mb-6">
            Simple, <span className="text-gradient-gold">Transparent Pricing</span>
          </h2>

          <div className="glass-card p-6 sm:p-12 mt-8">
            <p className="text-dark-300 text-base sm:text-lg mb-2">Premium photo prints from</p>
            <div className="flex items-end justify-center gap-2 mb-3">
              <span className="text-5xl sm:text-7xl font-display font-bold text-gradient-gold">£26.99</span>
            </div>
            <p className="text-sm text-dark-400">12×16" poster pricing shown. Shipping is calculated at checkout.</p>

            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 text-left max-w-xl mx-auto my-8 sm:my-10">
              {pricingFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-dark-200 text-sm sm:text-base">
                  <svg className="w-5 h-5 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {user ? (
                <Link href="/create" className="btn-gold text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4">
                  Create Your First Poster
                </Link>
              ) : (
                <Link href="/signin" className="btn-gold text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4">
                  Get Started Free
                </Link>
              )}
              <Link href="/support" className="btn-secondary text-base px-8 py-3.5">
                Read support policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800" />
        <div className="absolute inset-0 bg-glow-gradient opacity-40" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 sm:mb-6">
            Your Photos, Printed Right
          </h2>
          <p className="text-base sm:text-xl text-brand-100 mb-8 sm:mb-10 max-w-2xl mx-auto">
            Preview the print, check the quality, then order with confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            {user ? (
              <Link href="/create" className="inline-flex items-center gap-2 bg-white text-brand-600 hover:bg-dark-50 px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                Upload Your Photo
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              <Link href="/signin" className="inline-flex items-center gap-2 bg-white text-brand-600 hover:bg-dark-50 px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                Get Started Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            )}
            <Link href="/support" className="inline-flex items-center gap-2 text-white/90 hover:text-white px-4 py-2 text-sm sm:text-base font-medium">
              Need help before ordering?
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
