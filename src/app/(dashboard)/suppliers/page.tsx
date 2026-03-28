'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  Search,
  Truck,
  TrendingUp,
  AlertTriangle,
  Award,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Store,
} from 'lucide-react'
import { formatCurrency, debounce, cn } from '@/lib/utils'

interface SupplierMetrics {
  vendorName: string
  totalOrders: number
  totalSpend: number
  onTimeRate: number
  accuracyRate: number
  avgFulfillmentDays: number
  issueCount: number
  reliabilityScore: number
  receivedCount: number
  clientCount: number
}

interface SupplierSummary {
  totalVendors: number
  avgReliability: number
  topPerformer: string | null
  vendorsWithIssues: number
}

interface SuppliersResponse {
  success: boolean
  data?: {
    suppliers: SupplierMetrics[]
    summary: SupplierSummary
  }
  error?: string
}

type SortField = 'name' | 'reliability' | 'spend' | 'orders'

function ReliabilityBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (score >= 60) return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-red-50 text-red-700 border-red-200'
  }

  const getLabel = () => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Good'
    if (score >= 60) return 'Fair'
    return 'Poor'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="relative h-2 w-16 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all',
              score >= 80
                ? 'bg-emerald-500'
                : score >= 60
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">{score}</span>
      </div>
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
          getColor()
        )}
      >
        {getLabel()}
      </span>
    </div>
  )
}

function RateCell({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const getColor = () => {
    if (value >= 80) return 'text-emerald-600'
    if (value >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <span className={cn('text-sm font-medium tabular-nums', getColor())}>
      {value}{suffix}
    </span>
  )
}

export default function SuppliersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [suppliers, setSuppliers] = useState<SupplierMetrics[]>([])
  const [summary, setSummary] = useState<SupplierSummary>({
    totalVendors: 0,
    avgReliability: 0,
    topPerformer: null,
    vendorsWithIssues: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('reliability')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const fetchSuppliers = async (search: string = '', sort: SortField = 'reliability', direction: 'asc' | 'desc' = 'desc') => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        search,
        sortBy: sort,
        sortDirection: direction,
      })

      const response = await fetch(`/api/v1/suppliers?${params}`)
      const result: SuppliersResponse = await response.json()

      if (result.success && result.data) {
        setSuppliers(result.data.suppliers)
        setSummary(result.data.summary)
      } else {
        setError(result.error || 'Failed to load suppliers')
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const debouncedSearch = debounce((search: string) => {
    fetchSuppliers(search, sortBy, sortDirection)
  }, 300)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    if (searchQuery !== '') {
      debouncedSearch(searchQuery)
    } else {
      fetchSuppliers('', sortBy, sortDirection)
    }
  }, [searchQuery])

  const handleSort = (field: SortField) => {
    const newDirection = sortBy === field && sortDirection === 'desc' ? 'asc' : 'desc'
    setSortBy(field)
    setSortDirection(newDirection)
    fetchSuppliers(searchQuery, field, newDirection)
  }

  const handleRowClick = (vendorName: string) => {
    router.push(`/suppliers/${encodeURIComponent(vendorName)}`)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    )
  }

  const isAmazon = (name: string) =>
    name.toLowerCase().includes('amazon')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Suppliers</h1>
        <p className="text-muted-foreground">
          Track vendor performance and reliability across all purchase orders
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Vendors"
          value={summary.totalVendors}
          icon={<Truck className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Avg Reliability"
          value={`${summary.avgReliability}%`}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Top Performer"
          value={summary.topPerformer || 'N/A'}
          icon={<Award className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Vendors with Issues"
          value={summary.vendorsWithIssues}
          icon={<AlertTriangle className="h-5 w-5 text-primary" />}
        />
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading supplier data..." />
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
              <h3 className="text-lg font-medium text-foreground">Error Loading Data</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fetchSuppliers(searchQuery, sortBy, sortDirection)}
              >
                Retry
              </Button>
            </div>
          ) : suppliers.length === 0 ? (
            <EmptyState
              icon={<Store className="h-8 w-8 text-muted-foreground" />}
              title="No suppliers found"
              description={
                searchQuery
                  ? `No vendors match "${searchQuery}"`
                  : 'Supplier data will appear once purchase order items have vendor names assigned.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        Vendor Name
                        <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                        onClick={() => handleSort('reliability')}
                      >
                        Reliability
                        <SortIcon field="reliability" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                        onClick={() => handleSort('spend')}
                      >
                        Total Spend
                        <SortIcon field="spend" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center font-medium hover:text-foreground transition-colors"
                        onClick={() => handleSort('orders')}
                      >
                        Orders
                        <SortIcon field="orders" />
                      </button>
                    </TableHead>
                    <TableHead>On-Time Rate</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Avg. Days</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow
                      key={supplier.vendorName}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleRowClick(supplier.vendorName)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{supplier.vendorName}</span>
                          {isAmazon(supplier.vendorName) && (
                            <Badge variant="secondary" className="text-xs">
                              Major Source
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {supplier.clientCount} client{supplier.clientCount !== 1 ? 's' : ''} served
                        </div>
                      </TableCell>
                      <TableCell>
                        <ReliabilityBadge score={supplier.reliabilityScore} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {formatCurrency(supplier.totalSpend)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">{supplier.totalOrders}</span>
                      </TableCell>
                      <TableCell>
                        <RateCell value={supplier.onTimeRate} />
                      </TableCell>
                      <TableCell>
                        <RateCell value={supplier.accuracyRate} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {supplier.avgFulfillmentDays}d
                        </span>
                      </TableCell>
                      <TableCell>
                        {supplier.issueCount > 0 ? (
                          <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                            {supplier.issueCount}
                          </Badge>
                        ) : (
                          <span className="text-sm text-emerald-600">None</span>
                        )}
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
