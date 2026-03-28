'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatCard } from '@/components/shared/stat-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Store,
  CheckCircle2,
  Users,
  ShieldAlert,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ── Types ──

interface VendorSpend {
  vendorName: string
  totalSpend: number
  orderCount: number
  itemCount: number
}

interface ClientSpend {
  clientId: string
  clientName: string
  clientType: string
  totalSpend: number
  orderCount: number
  spendingLimit: number | null
  budgetUsed: number | null
}

interface MonthlySpend {
  month: string
  totalSpend: number
  orderCount: number
}

interface TypeSpend {
  type: string
  totalSpend: number
  clientCount: number
}

interface BudgetUtilization {
  clientId: string
  clientName: string
  clientType: string
  spent: number
  limit: number
  utilization: number
  remaining: number
}

interface AnalyticsData {
  summary: {
    totalSpend: number
    averageOrderValue: number
    activeVendors: number
    fulfillmentRate: number
    totalPOs: number
    totalItems: number
  }
  vendorSpend: VendorSpend[]
  clientSpend: ClientSpend[]
  typeSpend: TypeSpend[]
  monthlySpend: MonthlySpend[]
  budgetUtilization: BudgetUtilization[]
  period: string
  groupBy: string
}

interface AnalyticsResponse {
  success: boolean
  data?: AnalyticsData
  error?: string
}

const PERIODS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
]

const TYPE_COLORS: Record<string, string> = {
  SCHOOL: '#0D7377',
  GOVERNMENT: '#D4A843',
  HEALTHCARE: '#2D9CDB',
  NONPROFIT: '#6FCF97',
  CORPORATE: '#BB6BD9',
}

const TYPE_LABELS: Record<string, string> = {
  SCHOOL: 'School',
  GOVERNMENT: 'Government',
  HEALTHCARE: 'Healthcare',
  NONPROFIT: 'Nonprofit',
  CORPORATE: 'Corporate',
}

// ── Chart Components ──

function HorizontalBarChart({ data }: { data: VendorSpend[] }) {
  if (data.length === 0) return null
  const maxSpend = Math.max(...data.map((d) => d.totalSpend))

  return (
    <div className="space-y-3">
      {data.map((vendor) => {
        const percentage = maxSpend > 0 ? (vendor.totalSpend / maxSpend) * 100 : 0
        return (
          <div key={vendor.vendorName} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {vendor.vendorName}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {vendor.orderCount} orders
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(vendor.totalSpend)}
                </span>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${percentage}%`,
                  background: 'linear-gradient(90deg, #0D7377 0%, #0f9298 100%)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ data }: { data: TypeSpend[] }) {
  if (data.length === 0) return null
  const total = data.reduce((sum, d) => sum + d.totalSpend, 0)
  if (total === 0) return null

  // Build conic gradient
  let accumulated = 0
  const segments = data.map((d) => {
    const start = accumulated
    const percentage = (d.totalSpend / total) * 100
    accumulated += percentage
    return {
      ...d,
      start,
      end: accumulated,
      percentage,
      color: TYPE_COLORS[d.type] || '#94a3b8',
    }
  })

  const gradientParts = segments.map(
    (s) => `${s.color} ${s.start}% ${s.end}%`
  )
  const gradient = `conic-gradient(${gradientParts.join(', ')})`

  return (
    <div className="flex items-center gap-8">
      <div className="relative flex-shrink-0">
        <div
          className="w-40 h-40 rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-4 rounded-full bg-card flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
      <div className="space-y-2 flex-1">
        {segments.map((s) => (
          <div key={s.type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-sm text-foreground flex-1">
              {TYPE_LABELS[s.type] || s.type}
            </span>
            <span className="text-sm font-medium text-foreground">
              {s.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpendLineChart({ data }: { data: MonthlySpend[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Need at least 2 months of data to display a trend
      </div>
    )
  }

  const maxSpend = Math.max(...data.map((d) => d.totalSpend))
  const minSpend = Math.min(...data.map((d) => d.totalSpend))
  const range = maxSpend - minSpend || 1

  const svgWidth = 600
  const svgHeight = 200
  const padding = { top: 20, right: 20, bottom: 40, left: 20 }
  const chartWidth = svgWidth - padding.left - padding.right
  const chartHeight = svgHeight - padding.top - padding.bottom

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth
    const y =
      padding.top +
      chartHeight -
      ((d.totalSpend - minSpend) / range) * chartHeight
    return { x, y, ...d }
  })

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ')

  // Area fill path
  const areaPath = [
    `M ${points[0].x},${padding.top + chartHeight}`,
    `L ${points[0].x},${points[0].y}`,
    ...points.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${padding.top + chartHeight}`,
    'Z',
  ].join(' ')

  // Y-axis labels
  const yLabels = [minSpend, minSpend + range / 2, maxSpend]

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
      {/* Grid lines */}
      {yLabels.map((val, i) => {
        const y =
          padding.top + chartHeight - ((val - minSpend) / range) * chartHeight
        return (
          <line
            key={i}
            x1={padding.left}
            y1={y}
            x2={svgWidth - padding.right}
            y2={y}
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGradient)" opacity="0.3" />

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#0D7377"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill="white"
          stroke="#0D7377"
          strokeWidth="2"
        />
      ))}

      {/* X-axis labels */}
      {points.map((p, i) => {
        // Show label for first, last, and every other point
        if (data.length > 6 && i % 2 !== 0 && i !== data.length - 1) return null
        const parts = p.month.split('-')
        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ]
        const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(2)}`
        return (
          <text
            key={i}
            x={p.x}
            y={svgHeight - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="11"
          >
            {label}
          </text>
        )
      })}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D7377" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0D7377" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function BudgetBars({ data }: { data: BudgetUtilization[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        No clients with spending limits configured
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((client) => {
        const barWidth = Math.min(client.utilization, 100)
        const isOver = client.utilization > 100
        const isWarning = client.utilization > 80 && !isOver
        const barColor = isOver
          ? '#ef4444'
          : isWarning
            ? '#f59e0b'
            : '#0D7377'

        return (
          <div key={client.clientId}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {client.clientName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[client.clientType] || client.clientType}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(client.spent)} / {formatCurrency(client.limit)}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: barColor }}
                >
                  {client.utilization}%
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ──

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30d')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  const fetchAnalytics = useCallback(async (selectedPeriod: string) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ period: selectedPeriod })
      const response = await fetch(`/api/v1/analytics?${params}`)
      const result: AnalyticsResponse = await response.json()

      if (result.success && result.data) {
        setAnalyticsData(result.data)
      } else {
        setError(result.error || 'Failed to load analytics')
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to connect to analytics service')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user.role && ['ADMIN', 'MANAGER'].includes(session.user.role)) {
      fetchAnalytics(period)
    } else {
      setLoading(false)
    }
  }, [period, session, fetchAnalytics])

  const handlePeriodChange = (value: string) => {
    setPeriod(value)
  }

  // Access denied state
  if (!session?.user.role || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8 text-muted-foreground" />}
          title="Access Denied"
          description="You need Admin or Manager permissions to view spend analytics."
        />
      </div>
    )
  }

  // Loading state
  if (loading && !analyticsData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Spend Analytics</h1>
          <p className="text-muted-foreground">
            Vendor and client spend intelligence
          </p>
        </div>
        <LoadingState message="Loading analytics..." size="lg" />
      </div>
    )
  }

  // Error state
  if (error && !analyticsData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Spend Analytics</h1>
          <p className="text-muted-foreground">
            Vendor and client spend intelligence
          </p>
        </div>
        <EmptyState
          icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
          title="Unable to load analytics"
          description={error}
          action={{ label: 'Retry', onClick: () => fetchAnalytics(period) }}
        />
      </div>
    )
  }

  // Empty state
  if (!analyticsData || analyticsData.summary.totalPOs === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Spend Analytics</h1>
          <p className="text-muted-foreground">
            Vendor and client spend intelligence
          </p>
        </div>
        <EmptyState
          icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
          title="No spend data yet"
          description="Analytics will appear here once purchase orders are created and processed."
        />
      </div>
    )
  }

  const { summary, vendorSpend, clientSpend, typeSpend, monthlySpend, budgetUtilization } =
    analyticsData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Spend Analytics</h1>
          <p className="text-muted-foreground">
            Vendor and client spend intelligence
          </p>
        </div>
        <div className="w-48">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Spend"
          value={formatCurrency(summary.totalSpend)}
          icon={<DollarSign className="h-5 w-5 text-[#0D7377]" />}
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(summary.averageOrderValue)}
          icon={<TrendingUp className="h-5 w-5 text-[#D4A843]" />}
        />
        <StatCard
          title="Active Vendors"
          value={summary.activeVendors}
          icon={<Store className="h-5 w-5 text-[#2D9CDB]" />}
        />
        <StatCard
          title="Fulfillment Rate"
          value={`${summary.fulfillmentRate}%`}
          icon={<CheckCircle2 className="h-5 w-5 text-[#6FCF97]" />}
        />
      </div>

      {/* Charts Row: Vendor Bar + Type Donut */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Store className="h-5 w-5 text-[#0D7377]" />
              Top Vendors by Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vendorSpend.length > 0 ? (
              <HorizontalBarChart data={vendorSpend} />
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                No vendor data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-[#D4A843]" />
              Spend by Client Type
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {typeSpend.length > 0 ? (
              <DonutChart data={typeSpend} />
            ) : (
              <div className="text-sm text-muted-foreground">
                No client type data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spend Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[#0D7377]" />
            Spend Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SpendLineChart data={monthlySpend} />
        </CardContent>
      </Card>

      {/* Budget Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-[#D4A843]" />
            Budget Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BudgetBars data={budgetUtilization} />
        </CardContent>
      </Card>

      {/* Tables Row: Top Vendors + Top Clients */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            {vendorSpend.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorSpend.map((vendor) => (
                    <TableRow key={vendor.vendorName}>
                      <TableCell className="font-medium">
                        {vendor.vendorName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(vendor.totalSpend)}
                      </TableCell>
                      <TableCell className="text-right">
                        {vendor.orderCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {vendor.itemCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                No vendor data
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {clientSpend.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead className="text-right">Budget Left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientSpend.map((client) => (
                    <TableRow key={client.clientId}>
                      <TableCell className="font-medium">
                        {client.clientName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TYPE_LABELS[client.clientType] || client.clientType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(client.totalSpend)}
                      </TableCell>
                      <TableCell className="text-right">
                        {client.spendingLimit
                          ? formatCurrency(client.spendingLimit - client.totalSpend)
                          : 'No limit'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                No client data
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
