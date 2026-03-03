'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../components/providers/firebase-auth-provider'

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
          <div className="w-16 h-16 border-2 border-brand-500/30 rounded-full animate-spin" 
               style={{ borderTopColor: 'var(--color-brand)' }} />
          <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-gold-500/50 rounded-full animate-spin" 
               style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-900 overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 bg-glow-gradient opacity-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5" 
             style={{ 
               backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
               backgroundSize: '50px 50px'
             }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-dark-200">Museum-Quality Photo Prints</span>
              </div>
              
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight animate-fade-in-up">
                What You See
                <span className="block text-gradient mt-2">Is What You Get</span>
              </h1>
              
              <p className="mt-6 text-lg sm:text-xl text-dark-300 max-w-xl mx-auto lg:mx-0 animate-fade-in-up stagger-1">
                Print-first workflow built for real walls: quality checks before checkout, clear sizing, and no surprise crops.
              </p>
              
              <p className="mt-3 text-sm text-dark-500 max-w-xl mx-auto lg:mx-0 animate-fade-in-up stagger-1">
                170gsm premium matte paper • archival inks • trusted global fulfillment
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up stagger-2">
                {user ? (
                  <Link href="/create" className="btn-primary text-lg px-8 py-4">
                    Start Creating
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                ) : (
                  <Link href="/signin" className="btn-primary text-lg px-8 py-4">
                    Get Started Free
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                )}
                <Link href={user ? '/gallery' : '/signin'} className="btn-secondary text-lg px-8 py-4">
                  {user ? 'View Gallery' : 'Sign In to Gallery'}
                </Link>
              </div>

              {/* Trust badges */}
              <div className="mt-12 flex items-center gap-8 justify-center lg:justify-start text-dark-400 animate-fade-in-up stagger-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gold-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm">Archival Inks</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">Tracked Shipping</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm">300 DPI Print</span>
                </div>
              </div>
            </div>

            {/* Right - Hero Image/Visual */}
            <div className="relative hidden lg:block">
              <div className="relative">
                {/* Floating frames */}
                <div className="absolute -top-8 -left-8 w-48 h-64 glass-card p-3 rotate-[-8deg] animate-float shadow-glow">
                  <div className="w-full h-full bg-gradient-to-br from-brand-500/20 to-brand-600/20 rounded-lg" />
                </div>
                <div className="absolute top-16 -right-4 w-56 h-72 glass-card p-3 rotate-[6deg] animate-float shadow-card" style={{ animationDelay: '1s' }}>
                  <div className="w-full h-full bg-gradient-to-br from-gold-500/20 to-gold-600/20 rounded-lg" />
                </div>
                <div className="w-64 h-80 glass-card p-3 mx-auto rotate-[2deg] animate-float shadow-glow-lg" style={{ animationDelay: '0.5s' }}>
                  <div className="w-full h-full bg-gradient-to-br from-dark-700 to-dark-800 rounded-lg flex items-center justify-center">
                    <Image 
                      src="/modern-mosaics-logo.png" 
                      alt="Modern Mosaics" 
                      width={120} 
                      height={120}
                      className="opacity-80"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-24 bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-brand-400 text-sm font-medium uppercase tracking-wider">How It Works</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold text-white">
              Proof Before <span className="text-gradient">Print</span>
            </h2>
            <p className="mt-4 text-lg text-dark-300 max-w-2xl mx-auto">
              Every order is checked for real print suitability before you pay.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload',
                description: 'Start with your real photo or artwork. We preserve identity and focus on print readiness.',
                icon: '📷'
              },
              {
                step: '02',
                title: 'Check Quality',
                description: 'See DPI confidence by size before checkout, including recommended max size for sharper output.',
                icon: '🖼️'
              },
              {
                step: '03',
                title: 'Print & Deliver',
                description: 'Place your order with Stripe and fulfill through Gelato with tracked delivery.',
                icon: '📦'
              }
            ].map((item, i) => (
              <div 
                key={item.step}
                className="group relative glass-card p-8 hover:border-brand-500/30 transition-all duration-300"
              >
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center text-white font-bold shadow-glow">
                  {item.step}
                </div>
                <div className="mt-4">
                  <span className="text-4xl mb-4 block">{item.icon}</span>
                  <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                  <p className="text-dark-300">{item.description}</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-brand-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-b-xl" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-24 bg-dark-900">
        <div className="absolute inset-0 bg-glow-gradient opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-gold-500 text-sm font-medium uppercase tracking-wider">Print Proof System</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold text-white">
              Built for <span className="text-gradient-gold">Output Quality</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🧪', title: 'DPI Confidence', desc: 'Size-by-size quality status before payment so buyers avoid blurry outputs.' },
              { icon: '🛡️', title: 'Size Guardrails', desc: 'Low-quality size selections are blocked with a safer recommended size.' },
              { icon: '⚙️', title: 'Deterministic Edits', desc: 'Photo enhancement path is non-generative and consistent for print prep.' },
              { icon: '🌍', title: 'Reliable Fulfillment', desc: 'Stripe checkout and Gelato production with tracked delivery support.' },
            ].map((feature, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5 hover:border-brand-500/20 transition-colors">
                <span className="text-4xl mb-4 block">{feature.icon}</span>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-dark-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-brand-400 text-sm font-medium uppercase tracking-wider">Order Proof</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold text-white">
              What We <span className="text-gradient">Validate</span>
            </h2>
            <p className="mt-4 text-sm text-dark-500">Built-in checks designed for better print outcomes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: 'Quality Gate', text: 'Images are scored by effective DPI against your selected size before checkout.', rating: 5 },
              { name: 'No Surprise Crop', text: 'Preview reflects the intended print framing and warns when results may look soft.', rating: 5 },
              { name: 'Tracked Fulfillment', text: 'Orders move through payment, production, and delivery with status visibility.', rating: 5 },
            ].map((testimonial, i) => (
              <div key={i} className="glass-card p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-gold-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-dark-200 mb-4 italic">"{testimonial.text}"</p>
                <p className="text-brand-400 font-medium">— {testimonial.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 bg-dark-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-gold-500 text-sm font-medium uppercase tracking-wider">Pricing</span>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl font-bold text-white mb-6">
            Simple, <span className="text-gradient-gold">Transparent Pricing</span>
          </h2>
          
          <div className="glass-card p-8 sm:p-12 mt-8">
            <p className="text-dark-300 text-lg mb-2">Premium photo prints from</p>
            <div className="flex items-baseline justify-center gap-2 mb-6">
              <span className="text-6xl sm:text-7xl font-display font-bold text-gradient-gold">£26.99</span>
            </div>
            <p className="text-dark-400 mb-8">Prices shown convert to your local currency at checkout</p>
            
            <div className="grid sm:grid-cols-2 gap-4 text-left max-w-md mx-auto mb-10">
              {[
                'Archival paper or canvas',
                'Sizes up to 18×24"',
                'Fade-resistant inks',
                'Tracked worldwide shipping',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-dark-200">
                  <svg className="w-5 h-5 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {user ? (
              <Link href="/create" className="btn-gold text-lg px-10 py-4">
                Create Your First Poster
              </Link>
            ) : (
              <Link href="/signin" className="btn-gold text-lg px-10 py-4">
                Get Started Free
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800" />
        <div className="absolute inset-0 bg-glow-gradient opacity-50" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            Your Photos, Printed Right
          </h2>
          <p className="text-xl text-brand-100 mb-10 max-w-2xl mx-auto">
            No guesswork. Preview your exact print before ordering.
          </p>
          
          {user ? (
            <Link href="/create" className="inline-flex items-center gap-2 bg-white text-brand-600 hover:bg-dark-50 px-10 py-4 rounded-xl text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
              Upload Your Photo
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          ) : (
            <Link href="/signin" className="inline-flex items-center gap-2 bg-white text-brand-600 hover:bg-dark-50 px-10 py-4 rounded-xl text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
              Get Started Free
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
