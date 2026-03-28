'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import {
  ClipboardList,
  Search,
  Download,
  CheckCircle,
  AlertTriangle,
  Shield,
  Truck,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse } from '@/types'

interface TrackerRow {
  id: string
  poNumber: string
  totalAmount: number
  status: string
  createdAt: string
  client: {
    id: string
    name: string
  }
  request: {
    id: string
    status: string
  } | null
  quote: {
    id: string
    quoteNumber: string
    status: string
  }
  verified: boolean
  procurement: {
    total: number
    purchased: number
    percent: number
  }
  receiving: {
    total: number
    received: number
    percent: number
  }
  shipment: {
    id: string
    status: string
    method: string
    trackingNumber: string | null
  } | null
  clientInvoice: {
    id: string
    status: string
    invoiceNumber: string
    paidAt: string | null
  } | null
  phase: string
  hasIssues: boolean
  isOverdue: boolean
}

type PhaseFilter = 'all' | 'sales' | 'procurement' | 'receiving' | 'delivery' | 'finance' | 'complete'

export default function TrackerPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [rows, setRows] = useState<TrackerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/v1/tracker')
      const result: ApiResponse<TrackerRow[]> = await response.json()

      if (result.success && result.data) {
        setRows(result.data)
      } else {
        setError(result.error || 'Failed to load tracker data')
      }
    } catch {
      setError('Failed to load tracker data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getRowColor = (row: TrackerRow): string => {
    if (row.phase === 'complete') return 'bg-green-50/50'
    if (row.hasIssues || row.isOverdue) return 'bg-red-50/50'
    if (row.status === 'NEEDS_CORRECTION') return 'bg-amber-50/50'
    return ''
  }

  const getPhaseSegments = (row: TrackerRow) => {
    const segments: { label: string; percent: number; color: string }[] = []

    // Sales phase
    const salesDone = row.request?.status === 'QUOTED' || row.request?.status === 'CLOSED'
    segments.push({
      label: 'Sales',
      percent: salesDone ? 100 : row.quote.status === 'ACCEPTED' ? 80 : row.quote.status === 'SENT' ? 60 : 40,
      color: salesDone ? '#22c55e' : '#0D7377',
    })

    // PO verification
    segments.push({
      label: 'PO',
      percent: row.verified ? 100 : row.status === 'NEEDS_CORRECTION' ? 30 : 50,
      color: row.verified ? '#22c55e' : row.status === 'NEEDS_CORRECTION' ? '#f59e0b' : '#0D7377',
    })

    // Procurement
    segments.push({
      label: 'Buy',
      percent: row.procurement.percent,
      color: row.procurement.percent === 100 ? '#22c55e' : row.procurement.percent > 0 ? '#3b82f6' : '#e5e7eb',
    })

    // Receiving
    segments.push({
      label: 'Recv',
      percent: row.receiving.percent,
      color: row.receiving.percent === 100 ? '#22c55e' : row.receiving.percent > 0 ? '#8b5cf6' : '#e5e7eb',
    })

    // Delivery
    const deliveryPercent = !row.shipment ? 0
      : row.shipment.status === 'DELIVERED' ? 100
      : row.shipment.status === 'IN_TRANSIT' ? 70
      : row.shipment.status === 'READY' ? 40
      : row.shipment.status === 'FAILED' ? 20
      : 20
    segments.push({
      label: 'Ship',
      percent: deliveryPercent,
      color: deliveryPercent === 100 ? '#22c55e' : row.shipment?.status === 'FAILED' ? '#ef4444' : deliveryPercent > 0 ? '#6366f1' : '#e5e7eb',
    })

    // Finance
    const financePercent = !row.clientInvoice ? 0
      : row.clientInvoice.status === 'PAID' ? 100
      : row.clientInvoice.status === 'SENT' ? 60
      : 30
    segments.push({
      label: '$',
      percent: financePercent,
      color: financePercent === 100 ? '#22c55e' : financePercent > 0 ? '#D4A843' : '#e5e7eb',
    })

    return segments
  }

  // Filter and search
  const filtered = rows.filter((row) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!row.poNumber.toLowerCase().includes(q) && !row.client.name.toLowerCase().includes(q)) {
        return false
      }
    }
    if (phaseFilter !== 'all' && row.phase !== phaseFilter) return false
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortColumn) {
      case 'poNumber': return a.poNumber.localeCompare(b.poNumber) * dir
      case 'client': return a.client.name.localeCompare(b.client.name) * dir
      case 'amount': return (a.totalAmount - b.totalAmount) * dir
      case 'procurement': return (a.procurement.percent - b.procurement.percent) * dir
      case 'receiving': return (a.receiving.percent - b.receiving.percent) * dir
      case 'createdAt':
      default: return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
    }
  })

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDir('asc')
    }
  }

  const exportCSV = () => {
    const headers = ['PO Number', 'Client', 'Amount', 'PO Status', 'Request Status', 'Quote Status', 'Procurement %', 'Receiving %', 'Shipment Status', 'Invoice Status', 'Phase', 'Created']
    const csvRows = sorted.map((row) => [
      row.poNumber,
      row.client.name,
      row.totalAmount.toFixed(2),
      row.status,
      row.request?.status || 'N/A',
      row.quote.status,
      `${row.procurement.percent}%`,
      `${row.receiving.percent}%`,
      row.shipment?.status || 'None',
      row.clientInvoice?.status || 'None',
      row.phase,
      formatDate(row.createdAt),
    ])

    const csv = [headers, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lotus-tracker-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSortIndicator = (column: string) => {
    if (sortColumn !== column) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  if (loading) {
    return <LoadingState message="Loading order tracker..." size="lg" />
  }

  if (error) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
        title="Failed to load tracker"
        description={error}
        action={{ label: 'Retry', onClick: fetchData }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Order Tracker</h1>
          <p className="text-muted-foreground">Full lifecycle view of every purchase order</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Pills */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          {rows.filter((r) => r.phase === 'complete').length} Complete
        </Badge>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {rows.filter((r) => r.phase !== 'complete' && !r.hasIssues).length} In Progress
        </Badge>
        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
          {rows.filter((r) => r.status === 'NEEDS_CORRECTION').length} Needs Correction
        </Badge>
        <Badge variant="secondary" className="bg-red-100 text-red-800">
          {rows.filter((r) => r.hasIssues || r.isOverdue).length} Issues
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by PO number or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as PhaseFilter)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="procurement">Procurement</SelectItem>
                <SelectItem value="receiving">Receiving</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="PO Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="NEEDS_CORRECTION">Needs Correction</SelectItem>
                <SelectItem value="IN_PURCHASING">In Purchasing</SelectItem>
                <SelectItem value="PARTIALLY_FULFILLED">Partially Fulfilled</SelectItem>
                <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tracker Table */}
      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                title="No orders found"
                description="Adjust your filters or search to see results."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead
                      className="cursor-pointer hover:text-primary whitespace-nowrap"
                      onClick={() => toggleSort('client')}
                    >
                      Client{getSortIndicator('client')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-primary whitespace-nowrap"
                      onClick={() => toggleSort('poNumber')}
                    >
                      PO #{getSortIndicator('poNumber')}
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Sales</TableHead>
                    <TableHead className="whitespace-nowrap">PO Status</TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-primary whitespace-nowrap"
                      onClick={() => toggleSort('procurement')}
                    >
                      Procurement{getSortIndicator('procurement')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:text-primary whitespace-nowrap"
                      onClick={() => toggleSort('receiving')}
                    >
                      Receiving{getSortIndicator('receiving')}
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Delivery</TableHead>
                    <TableHead className="whitespace-nowrap">Finance</TableHead>
                    <TableHead className="whitespace-nowrap">Overall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((row) => {
                    const segments = getPhaseSegments(row)
                    return (
                      <TableRow key={row.id} className={`${getRowColor(row)} hover:bg-muted/30`}>
                        {/* Client */}
                        <TableCell>
                          <span className="text-sm font-medium">{row.client.name}</span>
                        </TableCell>

                        {/* PO Number */}
                        <TableCell>
                          <Link
                            href={`/orders/${row.id}`}
                            className="font-mono text-sm text-primary hover:underline font-medium"
                          >
                            {row.poNumber}
                          </Link>
                        </TableCell>

                        {/* Sales */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {row.request && <StatusPill status={row.request.status} size="sm" />}
                            <StatusPill status={row.quote.status} size="sm" />
                          </div>
                        </TableCell>

                        {/* PO Status */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StatusPill status={row.status} size="sm" />
                            {row.verified && (
                              <Shield className="h-3 w-3 text-green-600" />
                            )}
                          </div>
                        </TableCell>

                        {/* Procurement */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all"
                                  style={{ width: `${row.procurement.percent}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {row.procurement.purchased}/{row.procurement.total}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Receiving */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-purple-500 transition-all"
                                  style={{ width: `${row.receiving.percent}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {row.receiving.received}/{row.receiving.total}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Delivery */}
                        <TableCell>
                          {row.shipment ? (
                            <div className="flex items-center gap-1">
                              <StatusPill status={row.shipment.status} size="sm" />
                              <StatusPill status={row.shipment.method} size="sm" />
                              {row.shipment.trackingNumber && (
                                <span className="text-xs font-mono text-muted-foreground truncate max-w-[80px]">
                                  {row.shipment.trackingNumber}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No shipment</span>
                          )}
                        </TableCell>

                        {/* Finance */}
                        <TableCell>
                          {row.clientInvoice ? (
                            <div className="flex items-center gap-1">
                              <StatusPill status={row.clientInvoice.status} size="sm" />
                              {row.clientInvoice.paidAt && (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No invoice</span>
                          )}
                        </TableCell>

                        {/* Overall Progress */}
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            {segments.map((seg, idx) => (
                              <div
                                key={idx}
                                className="h-4 w-5 rounded-sm transition-all"
                                style={{ backgroundColor: seg.color, opacity: seg.percent > 0 ? 0.4 + (seg.percent / 100) * 0.6 : 0.15 }}
                                title={`${seg.label}: ${seg.percent}%`}
                              />
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium">Row Colors:</span>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-green-100" />
              <span>Complete</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-white border" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-amber-100" />
              <span>Needs Attention</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-red-100" />
              <span>Issues/Overdue</span>
            </div>
            <span className="ml-4 font-medium">Progress Segments:</span>
            <span>Sales | PO | Buy | Recv | Ship | $</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
