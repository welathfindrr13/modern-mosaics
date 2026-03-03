'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardUI } from './dashboard-ui'
import { CreationCard } from '@/components/dashboard/CreationCard'
import { OrderCard } from '@/components/dashboard/OrderCard'
import { OrderStatus } from '@/models/order'
import { useAuth } from '@/components/providers/firebase-auth-provider'

interface GalleryImage {
  id: string
  publicId: string
  secureUrl: string
  prompt?: string
  createdAt: string
}

interface OrderData {
  orderId: string
  gelatoOrderId: string
  status: OrderStatus
  createdAt: string
  productName?: string
}

export default function Dashboard() {
  return (
    <DashboardUI>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </DashboardUI>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-4 bg-dark-700 rounded w-1/2 mb-3" />
            <div className="h-8 bg-dark-700 rounded w-1/3" />
          </div>
        ))}
      </div>
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-dark-700 rounded w-1/4 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-dark-700 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardContent() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isAuthenticated = !!user && !user.isAnonymous

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/signin')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated) return
      
      try {
        setLoading(true)
        
        // Fetch images and orders in parallel
        const [imagesRes, ordersRes] = await Promise.all([
          fetch('/api/images/gallery', { credentials: 'include' }),
          fetch('/api/orders/list', { credentials: 'include' })
        ])
        
        if (imagesRes.ok) {
          const data = await imagesRes.json()
          setImages(data.images || [])
        }
        
        if (ordersRes.ok) {
          const data = await ordersRes.json()
          const transformedOrders: OrderData[] = data.orders.map((order: any) => ({
            orderId: order.referenceId,
            gelatoOrderId: order.gelatoOrderId || 'Unknown',
            status: order.status,
            createdAt: order.createdAt,
            productName: order.productDetails?.name || 'Custom Print'
          }))
          setOrders(transformedOrders)
        }
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    if (isAuthenticated) {
      fetchData()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [isAuthenticated, authLoading])

  if (authLoading || (!isAuthenticated && loading)) {
    return (
      <div className="glass-card p-8 text-center animate-pulse">
        <div className="h-5 w-40 bg-dark-700 rounded mx-auto mb-4" />
        <div className="h-4 w-64 bg-dark-700 rounded mx-auto" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center border-red-500/20">
        <span className="text-4xl mb-4 block">⚠️</span>
        <h2 className="text-xl font-semibold text-white mb-2">Error Loading Dashboard</h2>
        <p className="text-dark-400 mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary">
          Retry
        </button>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const userName = user?.email ? user.email.split('@')[0] : 'there'

  return (
    <div className="space-y-8">
      {/* Welcome & Stats */}
      <div className="glass-card p-6">
        <h2 className="text-2xl font-display font-bold text-white mb-2">
          Welcome back, <span className="text-gradient">{userName}</span>!
        </h2>
        <p className="text-dark-400">Here's an overview of your activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Total Creations</p>
              <p className="text-3xl font-bold text-white mt-1">{images.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">Total Orders</p>
              <p className="text-3xl font-bold text-white mt-1">{orders.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gold-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-400">In Progress</p>
              <p className="text-3xl font-bold text-white mt-1">
                {orders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELED).length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Creations */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">Recent Creations</h3>
          <Link href="/gallery" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card overflow-hidden animate-pulse">
                <div className="aspect-square bg-dark-700" />
                <div className="p-4">
                  <div className="h-4 bg-dark-700 rounded mb-2" />
                  <div className="h-3 bg-dark-700 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <span className="text-5xl mb-4 block">✨</span>
            <h3 className="text-lg font-semibold text-white mb-2">No creations yet</h3>
            <p className="text-dark-400 mb-6">Create your first custom print</p>
            <Link href="/create" className="btn-primary">
              Create Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.slice(0, 6).map((image) => (
              <CreationCard
                key={image.id}
                id={image.id}
                imageUrl={image.secureUrl}
                publicId={image.publicId}
                prompt={image.prompt}
                createdAt={image.createdAt}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Orders */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">Recent Orders</h3>
          <Link href="/dashboard/orders" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            View All →
          </Link>
        </div>
        
        {orders.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <span className="text-5xl mb-4 block">📦</span>
            <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
            <p className="text-dark-400">Order prints of your creations to see them here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <OrderCard
                key={order.orderId}
                orderId={order.orderId}
                gelatoOrderId={order.gelatoOrderId}
                status={order.status}
                createdAt={order.createdAt}
                productName={order.productName}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
