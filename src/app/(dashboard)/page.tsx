'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StatCard } from '@/components/shared/stat-card'
import { LoadingState } from '@/components/shared/loading-state'
import { CreateClientDialog } from '@/components/shared/create-client-dialog'
import { CreateRequestDialog } from '@/components/shared/create-request-dialog'
import { CreateQuoteDialog } from '@/components/shared/create-quote-dialog'
import {
  Users,
  FileText,
  Receipt,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface DashboardStats {
  totalClients: number
  totalRequests: number
  totalQuotes: number
  totalPurchaseOrders: number
  openRequests: number
  pendingQuotes: number
  overdueItems: number
  totalRevenue: number
  recentActivity: {
    id: string
    action: string
    entityType: string
    createdAt: string
    user: {
      name: string | null
      role: string
    }
  }[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/dashboard')
      const result = await response.json()
      if (result.success && result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleDialogSuccess = () => {
    fetchDashboard()
  }

  if (loading || !stats) {
    return <LoadingState message="Loading dashboard..." />
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your procurement command center
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Clients"
          value={stats.totalClients}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Open Requests"
          value={stats.openRequests}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          title="Pending Quotes"
          value={stats.pendingQuotes}
          icon={<Receipt className="h-4 w-4" />}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Orders"
          value={stats.totalPurchaseOrders}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          title="Overdue Items"
          value={stats.overdueItems}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          title="Total Requests"
          value={stats.totalRequests}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {/* Recent Activity */}
      <div className="lotus-card p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <span className="text-sm font-medium">
                    {activity.user.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.user.name} {activity.action} a {activity.entityType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleDateString()} at{' '}
                    {new Date(activity.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="lotus-card p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => setRequestDialogOpen(true)}
            className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">New Request</span>
          </button>
          <button
            onClick={() => setQuoteDialogOpen(true)}
            className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <Receipt className="h-4 w-4" />
            <span className="text-sm font-medium">Create Quote</span>
          </button>
          <button
            onClick={() => setClientDialogOpen(true)}
            className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Add Client</span>
          </button>
          <button
            onClick={() => router.push('/orders')}
            className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm font-medium">Review Orders</span>
          </button>
        </div>
      </div>

      {/* Dialogs */}
      <CreateRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSuccess={handleDialogSuccess}
      />
      <CreateQuoteDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onSuccess={handleDialogSuccess}
      />
      <CreateClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}
