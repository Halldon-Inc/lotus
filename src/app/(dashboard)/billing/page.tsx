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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import { StatCard } from '@/components/shared/stat-card'
import {
  Receipt,
  DollarSign,
  Send,
  CheckCircle,
  AlertTriangle,
  Plus,
  Search,
  FileText,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ApiResponse } from '@/types'

interface ClientInvoiceSummary {
  id: string
  invoiceNumber: string
  totalAmount: number
  status: string
  sentAt: string | null
  dueDate: string | null
  paidAt: string | null
  createdAt: string
  purchaseOrder: {
    id: string
    poNumber: string
  }
  client: {
    id: string
    name: string
  }
}

interface DeliveredPO {
  id: string
  poNumber: string
  totalAmount: number
  client: {
    id: string
    name: string
  }
}

interface BillingStats {
  draft: number
  sent: number
  paidThisMonth: number
  overdue: number
}

export default function BillingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [invoices, setInvoices] = useState<ClientInvoiceSummary[]>([])
  const [stats, setStats] = useState<BillingStats>({ draft: 0, sent: 0, paidThisMonth: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Create invoice
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deliveredPOs, setDeliveredPOs] = useState<DeliveredPO[]>([])
  const [selectedPOId, setSelectedPOId] = useState('')
  const [creatingInvoice, setCreatingInvoice] = useState(false)

  // QuickBooks sync
  const [qbConnected, setQbConnected] = useState(false)
  const [qbSyncing, setQbSyncing] = useState(false)
  const [qbSyncMessage, setQbSyncMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/v1/client-invoices?${params.toString()}`)
      const result: ApiResponse<{ invoices: ClientInvoiceSummary[]; stats: BillingStats }> = await response.json()

      if (result.success && result.data) {
        setInvoices(result.data.invoices || [])
        setStats(result.data.stats || { draft: 0, sent: 0, paidThisMonth: 0, overdue: 0 })
      }
    } catch {
      setError('Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const checkQb = async () => {
      try {
        const res = await fetch('/api/v1/quickbooks/status')
        const result = await res.json()
        if (result.success && result.data?.connected) {
          setQbConnected(true)
        }
      } catch {
        // QB not available
      }
    }
    checkQb()
  }, [])

  const handleQbSync = async () => {
    setQbSyncing(true)
    setQbSyncMessage(null)
    try {
      const res = await fetch('/api/v1/quickbooks/sync/invoices', { method: 'POST' })
      const result = await res.json()
      if (result.success) {
        const count = result.data?.synced ?? 0
        setQbSyncMessage({ text: `Synced ${count} invoices to QuickBooks`, type: 'success' })
      } else {
        setQbSyncMessage({ text: result.error || 'Sync failed', type: 'error' })
      }
    } catch {
      setQbSyncMessage({ text: 'Network error during sync', type: 'error' })
    } finally {
      setQbSyncing(false)
      setTimeout(() => setQbSyncMessage(null), 5000)
    }
  }

  const openCreateDialog = async () => {
    setCreateDialogOpen(true)
    try {
      const response = await fetch('/api/v1/client-invoices?view=available-pos')
      const result: ApiResponse<DeliveredPO[]> = await response.json()
      if (result.success && result.data) {
        setDeliveredPOs(result.data)
      }
    } catch {
      console.error('Failed to fetch available POs')
    }
  }

  const createInvoice = async () => {
    if (!selectedPOId) return
    try {
      setCreatingInvoice(true)
      const response = await fetch('/api/v1/client-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId: selectedPOId }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setCreateDialogOpen(false)
        setSelectedPOId('')
        fetchData()
      }
    } catch {
      console.error('Failed to create invoice')
    } finally {
      setCreatingInvoice(false)
    }
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.client.name.toLowerCase().includes(q) ||
      inv.purchaseOrder.poNumber.toLowerCase().includes(q)
    )
  })

  const isOverdue = (inv: ClientInvoiceSummary) => {
    return inv.status === 'SENT' && inv.dueDate && new Date(inv.dueDate) < new Date()
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER'].includes(session.user.role)

  if (loading) {
    return <LoadingState message="Loading billing..." size="lg" />
  }

  if (error) {
    return (
      <EmptyState
        icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
        title="Failed to load billing"
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
          <h1 className="text-3xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground">Client invoicing and accounts receivable</p>
        </div>
        <div className="flex items-center gap-2">
          {qbConnected ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleQbSync}
                disabled={qbSyncing}
                title="Sync invoices to QuickBooks"
              >
                {qbSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                <span
                  className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: '#2CA01C' }}
                >
                  QB
                </span>
                Sync Invoices
              </Button>
              {qbSyncMessage && (
                <span className={`text-xs ${qbSyncMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {qbSyncMessage.text}
                </span>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Connect QuickBooks in Settings"
            >
              <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white bg-gray-400">
                QB
              </span>
              Sync Invoices
            </Button>
          )}
          {canManage && (
            <Button className="lotus-button" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Draft"
          value={stats.draft}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Sent"
          value={stats.sent}
          icon={<Send className="h-5 w-5" />}
        />
        <StatCard
          title="Paid (Month)"
          value={stats.paidThisMonth}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={<AlertTriangle className="h-5 w-5" />}
          className={stats.overdue > 0 ? 'border-red-200' : ''}
        />
      </div>

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Invoices</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
              title="No invoices found"
              description={searchQuery ? 'Try adjusting your search or filters.' : 'Create your first client invoice to get started.'}
              action={canManage ? { label: 'Create Invoice', onClick: openCreateDialog } : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    const overdue = isOverdue(inv)
                    return (
                      <TableRow
                        key={inv.id}
                        className={`cursor-pointer hover:bg-muted/50 ${overdue ? 'bg-red-50/50' : ''}`}
                        onClick={() => router.push(`/billing/${inv.id}`)}
                      >
                        <TableCell className="font-mono font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{inv.client.name}</TableCell>
                        <TableCell className="font-mono text-sm">{inv.purchaseOrder.poNumber}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(inv.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusPill status={overdue ? 'OVERDUE' : inv.status} size="sm" />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {inv.sentAt ? formatDate(inv.sentAt) : 'Not sent'}
                        </TableCell>
                        <TableCell className={`text-sm ${overdue ? 'text-red-600 font-medium' : ''}`}>
                          {inv.dueDate ? formatDate(inv.dueDate) : 'Not set'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {inv.paidAt ? formatDate(inv.paidAt) : 'Unpaid'}
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

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Client Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a delivered purchase order to invoice the client.
            </p>
            {deliveredPOs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No delivered POs available for invoicing.
              </p>
            ) : (
              <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a purchase order" />
                </SelectTrigger>
                <SelectContent>
                  {deliveredPOs.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.poNumber} | {po.client.name} | {formatCurrency(po.totalAmount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedPOId && (() => {
              const po = deliveredPOs.find((p) => p.id === selectedPOId)
              if (!po) return null
              return (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono font-medium">{po.poNumber}</p>
                        <p className="text-sm text-muted-foreground">{po.client.name}</p>
                      </div>
                      <p className="text-lg font-bold">{formatCurrency(po.totalAmount)}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })()}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="lotus-button"
                onClick={createInvoice}
                disabled={creatingInvoice || !selectedPOId}
              >
                {creatingInvoice ? 'Creating...' : 'Create Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
