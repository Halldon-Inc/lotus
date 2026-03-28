'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { MatchReviewPanel } from '@/components/shared/match-review-panel'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Search,
  Filter,
  Play,
  Clock,
  Receipt,
  FileText,
  DollarSign,
} from 'lucide-react'
import { formatCurrency, formatDate, debounce } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse } from '@/types'

interface MatchListItem {
  id: string
  status: string
  toleranceUsed: number | null
  details: string | null
  createdAt: string
  invoice: {
    id: string
    invoiceNumber: string
    vendorName: string
    totalAmount: number
  }
  purchaseOrder: {
    id: string
    poNumber: string
    totalAmount: number
    client: {
      id: string
      name: string
    }
  }
}

interface MatchesResponse {
  success: boolean
  data?: {
    items: MatchListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: string
}

interface MatchStats {
  total: number
  autoMatched: number
  partialMatch: number
  mismatch: number
  manualOverride: number
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'AUTO_MATCHED', label: 'Auto Matched' },
  { value: 'PARTIAL_MATCH', label: 'Partial Match' },
  { value: 'MISMATCH', label: 'Mismatch' },
  { value: 'MANUAL_OVERRIDE', label: 'Manual Override' },
]

function getStatusRowClass(status: string): string {
  switch (status) {
    case 'AUTO_MATCHED': return 'bg-green-50/50'
    case 'PARTIAL_MATCH': return 'bg-yellow-50/50'
    case 'MISMATCH': return 'bg-red-50/50'
    case 'MANUAL_OVERRIDE': return 'bg-purple-50/50'
    default: return ''
  }
}

function getVariance(match: MatchListItem): number {
  return match.purchaseOrder.totalAmount - match.invoice.totalAmount
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'AUTO_MATCHED': return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'PARTIAL_MATCH': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    case 'MISMATCH': return <XCircle className="h-4 w-4 text-red-600" />
    case 'MANUAL_OVERRIDE': return <ShieldCheck className="h-4 w-4 text-purple-600" />
    default: return <Clock className="h-4 w-4 text-gray-400" />
  }
}

export default function MatchingPage() {
  const { data: session } = useSession()
  const [matches, setMatches] = useState<MatchListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalMatches, setTotalMatches] = useState(0)
  const [stats, setStats] = useState<MatchStats>({ total: 0, autoMatched: 0, partialMatch: 0, mismatch: 0, manualOverride: 0 })
  const [batchRunning, setBatchRunning] = useState(false)
  const [reviewMatchId, setReviewMatchId] = useState<string | null>(null)

  const fetchMatches = async (search: string = '', status: string = 'all', page: number = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        pageSize: '10',
        sortBy: 'createdAt',
        sortDirection: 'desc',
      })

      if (status !== 'all') {
        params.set('status', status)
      }

      params.set('view', 'list')

      const response = await fetch(`/api/v1/matching?${params}`)
      const result: MatchesResponse = await response.json()

      if (result.success && result.data) {
        setMatches(result.data.items)
        setTotalPages(result.data.totalPages)
        setTotalMatches(result.data.total)
        setCurrentPage(result.data.page)
      }
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/v1/matching')
      const result: ApiResponse<MatchStats> = await response.json()
      if (result.success && result.data) {
        setStats(result.data)
      }
    } catch (err) {
      // Silent fail for stats
    }
  }

  const debouncedFetch = debounce((search: string, status: string) => {
    fetchMatches(search, status, 1)
  }, 300)

  useEffect(() => {
    fetchMatches()
    fetchStats()
  }, [])

  useEffect(() => {
    if (searchQuery !== '' || statusFilter !== 'all') {
      debouncedFetch(searchQuery, statusFilter)
    } else {
      fetchMatches('', 'all', 1)
    }
  }, [searchQuery, statusFilter])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handlePageChange = (page: number) => {
    fetchMatches(searchQuery, statusFilter, page)
  }

  const runBatchMatching = async () => {
    try {
      setBatchRunning(true)
      const response = await fetch('/api/v1/matching/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchMatches(searchQuery, statusFilter, currentPage)
        fetchStats()
      }
    } catch (err) {
      console.error('Batch matching failed:', err)
    } finally {
      setBatchRunning(false)
    }
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)

  // Exception queue: show PARTIAL_MATCH and MISMATCH items prominently
  const exceptionItems = matches.filter(m => m.status === 'PARTIAL_MATCH' || m.status === 'MISMATCH')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">3-Way Matching</h1>
          <p className="text-muted-foreground">
            Compare purchase orders, invoices, and received items
          </p>
        </div>
        {canManage && (
          <Button
            className="lotus-button"
            onClick={runBatchMatching}
            disabled={batchRunning}
          >
            <Play className="mr-2 h-4 w-4" />
            {batchRunning ? 'Running...' : 'Run All Matching'}
          </Button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Matches</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Auto Matched</p>
                <p className="text-2xl font-bold">{stats.autoMatched}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Partial Matches</p>
                <p className="text-2xl font-bold">{stats.partialMatch}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mismatches</p>
                <p className="text-2xl font-bold">{stats.mismatch}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exception Queue */}
      {statusFilter === 'all' && exceptionItems.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>Exception Queue ({exceptionItems.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptionItems.map((match) => (
                  <TableRow key={match.id} className={getStatusRowClass(match.status)}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(match.status)}
                        <StatusPill status={match.status} size="sm" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/invoices/${match.invoice.id}`}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {match.invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{match.invoice.vendorName}</TableCell>
                    <TableCell>
                      <Link
                        href={`/orders/${match.purchaseOrder.id}`}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {match.purchaseOrder.poNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-amber-600">
                        {formatCurrency(Math.abs(getVariance(match)))}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(match.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewMatchId(match.id)}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by vendor, invoice, or PO number..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
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

      {/* All Matches Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Match Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading match records..." />
          ) : matches.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-muted-foreground" />}
              title="No match records found"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'No matches found for your current filters'
                  : 'Run matching on invoices to start comparing against purchase orders.'
              }
              action={
                canManage
                  ? { label: 'Run All Matching', onClick: runBatchMatching }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>PO</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Invoice Amt</TableHead>
                    <TableHead>PO Amt</TableHead>
                    <TableHead>Variance</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.id} className={getStatusRowClass(match.status)}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(match.status)}
                          <StatusPill status={match.status} size="sm" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/invoices/${match.invoice.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {match.invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{match.invoice.vendorName}</TableCell>
                      <TableCell>
                        <Link
                          href={`/orders/${match.purchaseOrder.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {match.purchaseOrder.poNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{match.purchaseOrder.client.name}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatCurrency(match.invoice.totalAmount)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatCurrency(match.purchaseOrder.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${
                          getVariance(match) === 0 ? 'text-green-600' : 'text-amber-600'
                        }`}>
                          {getVariance(match) === 0 ? 'None' : formatCurrency(Math.abs(getVariance(match)))}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(match.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewMatchId(match.id)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * 10 + 1} to{' '}
                    {Math.min(currentPage * 10, totalMatches)} of {totalMatches} matches
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Match Review Panel */}
      <MatchReviewPanel
        matchId={reviewMatchId}
        onClose={() => {
          setReviewMatchId(null)
          fetchMatches(searchQuery, statusFilter, currentPage)
          fetchStats()
        }}
      />
    </div>
  )
}
