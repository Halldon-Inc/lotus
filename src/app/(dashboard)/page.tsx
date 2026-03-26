import { Suspense } from 'react'
import { StatCard } from '@/components/shared/stat-card'
import { LoadingState } from '@/components/shared/loading-state'
import {
  Users,
  FileText,
  Receipt,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { prisma } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

async function getDashboardStats() {
  const [
    totalClients,
    totalRequests,
    totalQuotes,
    totalPurchaseOrders,
    openRequests,
    pendingQuotes,
    overdueItems,
    totalRevenue,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.request.count(),
    prisma.quote.count(),
    prisma.purchaseOrder.count(),
    prisma.request.count({ where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } } }),
    prisma.quote.count({ where: { status: { in: ['DRAFT', 'SENT'] } } }),
    prisma.purchaseOrderItem.count({ where: { status: 'MISSING' } }),
    prisma.quote.aggregate({
      where: { status: 'ACCEPTED' },
      _sum: { totalAmount: true },
    }),
  ])

  return {
    totalClients,
    totalRequests,
    totalQuotes,
    totalPurchaseOrders,
    openRequests,
    pendingQuotes,
    overdueItems,
    totalRevenue: totalRevenue._sum.totalAmount || 0,
  }
}

async function getRecentActivity() {
  const recentActivity = await prisma.activityLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          role: true,
        },
      },
    },
  })

  return recentActivity
}

async function DashboardContent() {
  const stats = await getDashboardStats()
  const recentActivity = await getRecentActivity()

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
          change={{
            value: stats.openRequests > 10 ? 12 : -5,
            type: stats.openRequests > 10 ? 'positive' : 'negative',
          }}
        />
        <StatCard
          title="Pending Quotes"
          value={stats.pendingQuotes}
          icon={<Receipt className="h-4 w-4" />}
          change={{
            value: 8,
            type: 'positive',
          }}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<TrendingUp className="h-4 w-4" />}
          change={{
            value: 15,
            type: 'positive',
          }}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={stats.totalPurchaseOrders}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          title="Overdue Items"
          value={stats.overdueItems}
          icon={<AlertTriangle className="h-4 w-4" />}
          change={{
            value: stats.overdueItems > 0 ? -3 : 0,
            type: stats.overdueItems > 0 ? 'negative' : 'neutral',
          }}
        />
        <StatCard
          title="Avg. Resolution"
          value="3.2 days"
          icon={<Clock className="h-4 w-4" />}
          change={{
            value: -0.5,
            type: 'positive',
          }}
        />
        <StatCard
          title="Completion Rate"
          value="94%"
          icon={<CheckCircle className="h-4 w-4" />}
          change={{
            value: 2,
            type: 'positive',
          }}
        />
      </div>

      {/* Recent Activity */}
      <div className="lotus-card p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
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
          <button className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">New Request</span>
          </button>
          <button className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
            <Receipt className="h-4 w-4" />
            <span className="text-sm font-medium">Create Quote</span>
          </button>
          <button className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Add Client</span>
          </button>
          <button className="flex items-center space-x-2 p-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm font-medium">Review Orders</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading dashboard..." />}>
      <DashboardContent />
    </Suspense>
  )
}
