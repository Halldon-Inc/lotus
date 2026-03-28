'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { ReportDiscrepancyDialog } from '@/components/shared/report-discrepancy-dialog'
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Clock,
  Eye,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Image,
} from 'lucide-react'
import { formatDate, formatRelativeTime, cn } from '@/lib/utils'
import Link from 'next/link'

interface DiscrepancyItem {
  id: string
  type: string
  expectedValue: string
  actualValue: string
  status: string
  photoUrls: string | null
  resolutionNotes: string | null
  createdAt: string
  resolvedAt: string | null
  purchaseOrder: {
    id: string
    poNumber: string
    client: {
      id: string
      name: string
    }
  }
  purchaseOrderItem: {
    id: string
    quoteLineItem: {
      productName: string
      vendorName: string | null
    } | null
  } | null
  invoice: {
    id: string
    invoiceNumber: string
    vendorName: string
  } | null
  reportedBy: {
    id: string
    name: string
  }
  resolvedBy: {
    id: string
    name: string
  } | null
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'QUANTITY_MISMATCH', label: 'Quantity Mismatch' },
  { value: 'PRICE_MISMATCH', label: 'Price Mismatch' },
  { value: 'WRONG_ITEM', label: 'Wrong Item' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'EXTRA', label: 'Extra Items' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ESCALATED', label: 'Escalated' },
]

const TYPE_BADGE_MAP: Record<string, { label: string; className: string }> = {
  QUANTITY_MISMATCH: { label: 'Qty Mismatch', className: 'bg-blue-100 text-blue-800' },
  PRICE_MISMATCH: { label: 'Price Mismatch', className: 'bg-amber-100 text-amber-800' },
  WRONG_ITEM: { label: 'Wrong Item', className: 'bg-orange-100 text-orange-800' },
  DAMAGED: { label: 'Damaged', className: 'bg-red-100 text-red-800' },
  MISSING: { label: 'Missing', className: 'bg-purple-100 text-purple-800' },
  EXTRA: { label: 'Extra', className: 'bg-teal-100 text-teal-800' },
}

const STATUS_ROW_COLORS: Record<string, string> = {
  OPEN: 'border-l-4 border-l-red-500 bg-red-50/50',
  INVESTIGATING: 'border-l-4 border-l-yellow-500 bg-yellow-50/50',
  RESOLVED: 'border-l-4 border-l-green-500 bg-green-50/30',
  ESCALATED: 'border-l-4 border-l-purple-500 bg-purple-50/50',
}

function getDaysOpen(createdAt: string, resolvedAt: string | null): number {
  const start = new Date(createdAt)
  const end = resolvedAt ? new Date(resolvedAt) : new Date()
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function AgingBadge({ days, isResolved }: { days: number; isResolved: boolean }) {
  if (isResolved) {
    return (
      <span className="text-sm text-muted-foreground">
        {days}d (resolved)
      </span>
    )
  }

  if (days > 14) {
    return (
      <Badge variant="destructive" className="animate-pulse">
        {days}d CRITICAL
      </Badge>
    )
  }

  if (days > 7) {
    return (
      <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
        {days}d WARNING
      </Badge>
    )
  }

  return (
    <span className="text-sm text-muted-foreground">{days}d</span>
  )
}

export default function DiscrepanciesPage() {
  const { data: session } = useSession()
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})
  const [resolutionStatus, setResolutionStatus] = useState<Record<string, string>>({})
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  const fetchDiscrepancies = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        pageSize: '100',
        sortBy: 'createdAt',
        sortDirection: 'desc',
      })

      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(`/api/v1/discrepancies?${params}`)
      const result = await response.json()

      if (result.success && result.data) {
        setDiscrepancies(result.data.items || result.data)
      }
    } catch (error) {
      console.error('Error fetching discrepancies:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiscrepancies()
  }, [typeFilter, statusFilter])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchDiscrepancies()
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const handleResolve = async (discrepancyId: string) => {
    const notes = resolutionNotes[discrepancyId]
    const status = resolutionStatus[discrepancyId] || 'RESOLVED'

    setUpdatingIds((prev) => new Set(prev).add(discrepancyId))
    try {
      const response = await fetch(`/api/v1/discrepancies/${discrepancyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolutionNotes: notes || undefined,
        }),
      })

      if (response.ok) {
        setExpandedId(null)
        setResolutionNotes((prev) => {
          const next = { ...prev }
          delete next[discrepancyId]
          return next
        })
        setResolutionStatus((prev) => {
          const next = { ...prev }
          delete next[discrepancyId]
          return next
        })
        fetchDiscrepancies()
      }
    } catch (error) {
      console.error('Error updating discrepancy:', error)
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(discrepancyId)
        return next
      })
    }
  }

  // KPI calculations
  const openCount = discrepancies.filter((d) => d.status === 'OPEN').length
  const investigatingCount = discrepancies.filter((d) => d.status === 'INVESTIGATING').length
  const resolvedThisWeek = discrepancies.filter((d) => {
    if (d.status !== 'RESOLVED' || !d.resolvedAt) return false
    const resolved = new Date(d.resolvedAt)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return resolved >= weekAgo
  }).length
  const escalatedCount = discrepancies.filter((d) => d.status === 'ESCALATED').length

  const getVendorName = (d: DiscrepancyItem): string => {
    if (d.invoice?.vendorName) return d.invoice.vendorName
    if (d.purchaseOrderItem?.quoteLineItem?.vendorName) return d.purchaseOrderItem.quoteLineItem.vendorName
    return 'N/A'
  }

  const getItemName = (d: DiscrepancyItem): string => {
    if (d.purchaseOrderItem?.quoteLineItem?.productName) return d.purchaseOrderItem.quoteLineItem.productName
    return 'General'
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Discrepancies</h1>
          <p className="text-muted-foreground">
            Track and resolve order discrepancies
          </p>
        </div>
        <Button className="lotus-button" onClick={() => setShowReportDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Report Discrepancy
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open</p>
                <p className="text-2xl font-bold">{openCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Investigating</p>
                <p className="text-2xl font-bold">{investigatingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resolved (7d)</p>
                <p className="text-2xl font-bold">{resolvedThisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Escalated</p>
                <p className="text-2xl font-bold">{escalatedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number or vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Discrepancies Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Discrepancies</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading discrepancies..." />
          ) : discrepancies.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8 text-muted-foreground" />}
              title="No discrepancies found"
              description={
                searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                  ? 'No discrepancies match your current filters.'
                  : 'No discrepancies have been reported yet.'
              }
              action={{
                label: 'Report Discrepancy',
                onClick: () => setShowReportDialog(true),
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Type</TableHead>
                    <TableHead>PO #</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reported By</TableHead>
                    <TableHead>Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancies.map((disc) => {
                    const daysOpen = getDaysOpen(disc.createdAt, disc.resolvedAt)
                    const isExpanded = expandedId === disc.id
                    const typeBadge = TYPE_BADGE_MAP[disc.type] || {
                      label: disc.type,
                      className: 'bg-gray-100 text-gray-800',
                    }
                    const photoUrlList = disc.photoUrls
                      ? disc.photoUrls.split(',').filter((u) => u.trim())
                      : []

                    return (
                      <>
                        <TableRow
                          key={disc.id}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/50',
                            STATUS_ROW_COLORS[disc.status] || ''
                          )}
                          onClick={() =>
                            setExpandedId(isExpanded ? null : disc.id)
                          }
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                typeBadge.className
                              )}
                            >
                              {typeBadge.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/orders/${disc.purchaseOrder.id}`}
                              className="font-mono text-sm text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {disc.purchaseOrder.poNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{getItemName(disc)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{getVendorName(disc)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono">
                              {disc.expectedValue}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono">
                              {disc.actualValue}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusPill status={disc.status} size="sm" />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {disc.reportedBy.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <AgingBadge
                              days={daysOpen}
                              isResolved={disc.status === 'RESOLVED'}
                            />
                          </TableCell>
                        </TableRow>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <TableRow key={`${disc.id}-detail`} className="bg-muted/30">
                            <TableCell colSpan={10} className="p-0">
                              <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  {/* Linked Entities */}
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                      Linked Entities
                                    </h4>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">PO:</span>
                                        <Link
                                          href={`/orders/${disc.purchaseOrder.id}`}
                                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                        >
                                          {disc.purchaseOrder.poNumber}
                                          <ExternalLink className="h-3 w-3" />
                                        </Link>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Client:</span>
                                        <Link
                                          href={`/clients/${disc.purchaseOrder.client.id}`}
                                          className="text-sm text-primary hover:underline"
                                        >
                                          {disc.purchaseOrder.client.name}
                                        </Link>
                                      </div>
                                      {disc.invoice && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-muted-foreground">Invoice:</span>
                                          <Link
                                            href={`/invoices/${disc.invoice.id}`}
                                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                                          >
                                            {disc.invoice.invoiceNumber}
                                            <ExternalLink className="h-3 w-3" />
                                          </Link>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Photos */}
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                      Evidence
                                    </h4>
                                    {photoUrlList.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {photoUrlList.map((url, i) => (
                                          <a
                                            key={i}
                                            href={url.trim()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors"
                                          >
                                            <Image className="h-3 w-3" />
                                            Photo {i + 1}
                                          </a>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No photos attached</p>
                                    )}

                                    {disc.resolutionNotes && (
                                      <div className="mt-3">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">
                                          Resolution Notes:
                                        </p>
                                        <p className="text-sm rounded bg-muted p-2">
                                          {disc.resolutionNotes}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Resolution Form */}
                                  {disc.status !== 'RESOLVED' && (
                                    <div className="space-y-3">
                                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                        Update Status
                                      </h4>
                                      <div className="space-y-2">
                                        <Label className="text-xs">New Status</Label>
                                        <Select
                                          value={resolutionStatus[disc.id] || disc.status}
                                          onValueChange={(val) =>
                                            setResolutionStatus((prev) => ({
                                              ...prev,
                                              [disc.id]: val,
                                            }))
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="OPEN">Open</SelectItem>
                                            <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                                            <SelectItem value="RESOLVED">Resolved</SelectItem>
                                            <SelectItem value="ESCALATED">Escalated</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Resolution Notes</Label>
                                        <Textarea
                                          placeholder="Describe the resolution or update..."
                                          rows={3}
                                          className="resize-none"
                                          value={resolutionNotes[disc.id] || ''}
                                          onChange={(e) =>
                                            setResolutionNotes((prev) => ({
                                              ...prev,
                                              [disc.id]: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                      <Button
                                        size="sm"
                                        className="w-full"
                                        disabled={updatingIds.has(disc.id)}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleResolve(disc.id)
                                        }}
                                      >
                                        {updatingIds.has(disc.id) ? 'Updating...' : 'Update Discrepancy'}
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* Timestamps */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                                  <span>Reported: {formatDate(disc.createdAt)}</span>
                                  {disc.resolvedAt && (
                                    <span>Resolved: {formatDate(disc.resolvedAt)}</span>
                                  )}
                                  {disc.resolvedBy && (
                                    <span>By: {disc.resolvedBy.name}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Discrepancy Dialog */}
      <ReportDiscrepancyDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onSuccess={() => fetchDiscrepancies()}
      />
    </div>
  )
}
