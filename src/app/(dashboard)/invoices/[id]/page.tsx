'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { MatchReviewPanel } from '@/components/shared/match-review-panel'
import {
  ArrowLeft,
  Receipt,
  DollarSign,
  Calendar,
  Building2,
  User,
  ShoppingCart,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  CreditCard,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse } from '@/types'

interface InvoiceLineItemDetail {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface MatchRecordSummary {
  id: string
  status: string
  tolerancePercent: number
  totalVariance: number
  createdAt: string
  purchaseOrder: {
    id: string
    poNumber: string
  }
}

interface InvoiceDetail {
  id: string
  invoiceNumber: string
  vendorName: string
  totalAmount: number
  status: string
  dueDate: string | null
  receivedDate: string | null
  fileUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  purchaseOrder: {
    id: string
    poNumber: string
    totalAmount: number
    status: string
    client: {
      id: string
      name: string
      type: string
    }
  } | null
  createdBy: {
    id: string
    name: string
    email: string
  }
  lineItems: InvoiceLineItemDetail[]
  matches: MatchRecordSummary[]
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reviewMatchId, setReviewMatchId] = useState<string | null>(null)

  const invoiceId = params.id as string

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/invoices/${invoiceId}`)
      const result: ApiResponse<InvoiceDetail> = await response.json()

      if (result.success && result.data) {
        setInvoice(result.data)
      } else {
        setError(result.error || 'Failed to load invoice')
      }
    } catch (err) {
      setError('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    fetchInvoice()
  }, [fetchInvoice])

  const performAction = async (action: string, method: string = 'PUT') => {
    try {
      setActionLoading(action)
      const endpoint = action === 'run-match'
        ? '/api/v1/matching'
        : `/api/v1/invoices/${invoiceId}/${action}`

      const body = action === 'run-match'
        ? { invoiceId }
        : undefined

      const response = await fetch(endpoint, {
        method: action === 'run-match' ? 'POST' : method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchInvoice()
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'PAID') return false
    return new Date(dueDate).getTime() < new Date().getTime()
  }

  if (loading) {
    return <LoadingState message="Loading invoice details..." size="lg" />
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/invoices')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Button>
        <EmptyState
          icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
          title="Invoice not found"
          description={error || 'The invoice you are looking for does not exist.'}
          action={{ label: 'Back to Invoices', onClick: () => router.push('/invoices') }}
        />
      </div>
    )
  }

  const latestMatch = invoice.matches.length > 0 ? invoice.matches[0] : null

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/invoices')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Invoices
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-foreground font-mono">{invoice.invoiceNumber}</h1>
            <StatusPill status={invoice.status} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-sm font-medium">{invoice.vendorName}</span>
            <span className="text-sm text-muted-foreground">
              Created {formatDate(invoice.createdAt)} by {invoice.createdBy.name}
            </span>
            {invoice.dueDate && isOverdue(invoice.dueDate, invoice.status) && (
              <Badge variant="destructive">Overdue</Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {invoice.purchaseOrder && invoice.status !== 'PAID' && invoice.status !== 'MATCHED' && (
              <Button
                className="lotus-button"
                onClick={() => performAction('run-match', 'POST')}
                disabled={actionLoading === 'run-match'}
              >
                <Play className="mr-2 h-4 w-4" />
                {actionLoading === 'run-match' ? 'Matching...' : 'Run Match'}
              </Button>
            )}
            {invoice.status !== 'PAID' && (
              <Button
                variant="outline"
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                onClick={() => performAction('mark-paid')}
                disabled={actionLoading === 'mark-paid'}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {actionLoading === 'mark-paid' ? 'Processing...' : 'Mark as Paid'}
              </Button>
            )}
            {invoice.status !== 'DISPUTED' && invoice.status !== 'PAID' && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => performAction('dispute')}
                disabled={actionLoading === 'dispute'}
              >
                <XCircle className="mr-2 h-4 w-4" />
                {actionLoading === 'dispute' ? 'Processing...' : 'Dispute'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(invoice.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Line Items</p>
                <p className="text-2xl font-bold">{invoice.lineItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                <p className="text-2xl font-bold">
                  {invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Matches</p>
                <p className="text-2xl font-bold">{invoice.matches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Line Items Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.lineItems.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="h-8 w-8 text-muted-foreground" />}
                title="No line items"
                description="This invoice has no line items."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Grand Total */}
                <div className="mt-4 flex justify-end border-t pt-4">
                  <div className="w-64 space-y-2">
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-lg font-bold">Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(invoice.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Linked PO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Purchase Order</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.purchaseOrder ? (
                <Link
                  href={`/orders/${invoice.purchaseOrder.id}`}
                  className="block hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium font-mono">{invoice.purchaseOrder.poNumber}</p>
                      <StatusPill status={invoice.purchaseOrder.status} size="sm" />
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(invoice.purchaseOrder.totalAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center space-x-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{invoice.purchaseOrder.client.name}</span>
                  </div>
                </Link>
              ) : (
                <div className="text-center py-4">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No PO linked</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Link a purchase order to enable 3-way matching
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{invoice.vendorName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created By</span>
                <span>{invoice.createdBy.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(invoice.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatRelativeTime(invoice.updatedAt)}</span>
              </div>
              {invoice.fileUrl && (
                <div className="pt-2 border-t">
                  <a
                    href={invoice.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-primary hover:underline"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Invoice File
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              )}
              {invoice.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Match Records Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Match Records</CardTitle>
          {canManage && invoice.purchaseOrder && invoice.status !== 'PAID' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => performAction('run-match', 'POST')}
              disabled={actionLoading === 'run-match'}
            >
              <Play className="mr-2 h-4 w-4" />
              {actionLoading === 'run-match' ? 'Running...' : 'Run Match'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invoice.matches.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-muted-foreground" />}
              title="No matches yet"
              description={
                invoice.purchaseOrder
                  ? 'Run a match to compare this invoice against its linked PO.'
                  : 'Link a purchase order first, then run matching.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match Status</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Tolerance</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.matches.map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <StatusPill status={match.status} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/orders/${match.purchaseOrder.id}`}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {match.purchaseOrder.poNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{match.tolerancePercent}%</TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${
                        match.totalVariance === 0 ? 'text-green-600' : 'text-amber-600'
                      }`}>
                        {formatCurrency(Math.abs(match.totalVariance))}
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
          )}
        </CardContent>
      </Card>

      {/* Match Review Panel */}
      <MatchReviewPanel
        matchId={reviewMatchId}
        onClose={() => {
          setReviewMatchId(null)
          fetchInvoice()
        }}
      />
    </div>
  )
}
