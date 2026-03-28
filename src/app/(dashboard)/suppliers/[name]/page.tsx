'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import {
  ArrowLeft,
  Truck,
  Clock,
  Target,
  AlertTriangle,
  Zap,
  Users,
  Package,
  Store,
} from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

interface SupplierDetail {
  vendorName: string
  metrics: {
    totalOrders: number
    totalSpend: number
    onTimeRate: number
    accuracyRate: number
    avgFulfillmentDays: number
    issueCount: number
    reliabilityScore: number
    receivedCount: number
    speedScore: number
  }
  recentOrders: Array<{
    id: string
    status: string
    quantity: number
    receivedQuantity: number
    orderNumber: string | null
    trackingNumber: string | null
    expectedDeliveryDate: string | null
    receivedAt: string | null
    createdAt: string
    productName: string
    purchaseOrder: {
      id: string
      poNumber: string
    }
    client: {
      id: string
      name: string
      type: string
    }
  }>
  performanceOverTime: Array<{
    month: string
    totalItems: number
    onTimeRate: number
    accuracyRate: number
    issues: number
  }>
  clientsServed: Array<{
    id: string
    name: string
    type: string
    orderCount: number
  }>
  commonProducts: Array<{
    name: string
    count: number
    totalSpend: number
  }>
}

interface SupplierResponse {
  success: boolean
  data?: SupplierDetail
  error?: string
}

function getStatusLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (score >= 80) return { label: 'Good', color: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (score >= 60) return { label: 'Needs Attention', color: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'Poor', color: 'bg-red-50 text-red-700 border-red-200' }
}

function ScoreRing({
  value,
  label,
  icon,
  color,
}: {
  value: number
  label: string
  icon: React.ReactNode
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'teal'
}) {
  const getBarColor = () => {
    if (value >= 80) return 'bg-emerald-500'
    if (value >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    teal: 'bg-teal-50 text-teal-600',
  }

  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-card border">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg mb-3', colorMap[color])}>
        {icon}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}%</div>
      <div className="text-xs text-muted-foreground mt-1 text-center">{label}</div>
      <div className="w-full mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getBarColor())}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function PerformanceBar({ data }: { data: SupplierDetail['performanceOverTime'] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No monthly performance data available yet.
      </p>
    )
  }

  const maxItems = Math.max(...data.map((d) => d.totalItems), 1)

  return (
    <div className="space-y-2">
      {data.slice(-6).map((month) => (
        <div key={month.month} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-16 shrink-0 tabular-nums">
            {month.month}
          </span>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-4 rounded bg-gray-50 overflow-hidden relative">
              <div
                className={cn(
                  'h-full rounded transition-all',
                  month.onTimeRate >= 80
                    ? 'bg-emerald-400'
                    : month.onTimeRate >= 60
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                )}
                style={{ width: `${(month.totalItems / maxItems) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-20 text-right tabular-nums">
              {month.totalItems} items | {month.onTimeRate}%
            </span>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-emerald-400" />
          <span>On-time 80%+</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-amber-400" />
          <span>60-79%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-red-400" />
          <span>Below 60%</span>
        </div>
      </div>
    </div>
  )
}

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const vendorName = typeof params.name === 'string' ? decodeURIComponent(params.name) : ''

  useEffect(() => {
    if (!vendorName) return

    const fetchSupplier = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(
          `/api/v1/suppliers/${encodeURIComponent(vendorName)}`
        )
        const result: SupplierResponse = await response.json()

        if (result.success && result.data) {
          setSupplier(result.data)
        } else {
          setError(result.error || 'Failed to load supplier data')
        }
      } catch (err) {
        console.error('Error fetching supplier:', err)
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchSupplier()
  }, [vendorName])

  if (loading) {
    return <LoadingState message="Loading supplier scorecard..." size="lg" />
  }

  if (error || !supplier) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/suppliers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Suppliers
        </Button>
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mb-3" />
          <h3 className="text-lg font-medium text-foreground">
            {error || 'Supplier not found'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Could not load data for this vendor.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/suppliers')}
          >
            Return to Directory
          </Button>
        </div>
      </div>
    )
  }

  const { metrics } = supplier
  const statusInfo = getStatusLabel(metrics.reliabilityScore)

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push('/suppliers')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Suppliers
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{supplier.vendorName}</h1>
              {supplier.vendorName.toLowerCase().includes('amazon') && (
                <Badge variant="secondary">Major Source</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground">
                {metrics.totalOrders} total orders | {formatCurrency(metrics.totalSpend)} total spend
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-4xl font-bold text-foreground tabular-nums">
              {metrics.reliabilityScore}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Reliability Score
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
              statusInfo.color
            )}
          >
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <ScoreRing
          value={metrics.onTimeRate}
          label="On-Time Delivery"
          icon={<Clock className="h-5 w-5" />}
          color="emerald"
        />
        <ScoreRing
          value={metrics.accuracyRate}
          label="Quantity Accuracy"
          icon={<Target className="h-5 w-5" />}
          color="blue"
        />
        <ScoreRing
          value={metrics.totalOrders > 0 ? Math.round(((metrics.totalOrders - metrics.issueCount) / metrics.totalOrders) * 100) : 100}
          label="Issue-Free Rate"
          icon={<AlertTriangle className="h-5 w-5" />}
          color="amber"
        />
        <ScoreRing
          value={metrics.speedScore}
          label={`Fulfillment Speed (${metrics.avgFulfillmentDays}d avg)`}
          icon={<Zap className="h-5 w-5" />}
          color="teal"
        />
      </div>

      {/* Performance Over Time + Clients Served */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceBar data={supplier.performanceOverTime} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clients Served ({supplier.clientsServed.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplier.clientsServed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No client data available.
              </p>
            ) : (
              <div className="space-y-2">
                {supplier.clientsServed.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{client.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {client.type.toLowerCase()}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {client.orderCount} order{client.orderCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Common Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            Common Products ({supplier.commonProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {supplier.commonProducts.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="No product data"
              description="Product information will appear once orders have linked quote line items."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Times Ordered</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.commonProducts.slice(0, 10).map((product) => (
                    <TableRow key={product.name}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {product.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(product.totalSpend)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent Orders ({supplier.recentOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {supplier.recentOrders.length === 0 ? (
            <EmptyState
              icon={<Store className="h-8 w-8 text-muted-foreground" />}
              title="No recent orders"
              description="Order history will appear as purchase order items are created for this vendor."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Received At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {order.productName}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {order.purchaseOrder.poNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{order.client.name}</span>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={order.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {order.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={cn(
                            order.receivedQuantity !== order.quantity &&
                              order.receivedQuantity > 0
                              ? 'text-amber-600'
                              : ''
                          )}
                        >
                          {order.receivedQuantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {order.expectedDeliveryDate
                            ? formatDate(order.expectedDeliveryDate)
                            : 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {order.receivedAt
                            ? formatDate(order.receivedAt)
                            : 'Pending'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
