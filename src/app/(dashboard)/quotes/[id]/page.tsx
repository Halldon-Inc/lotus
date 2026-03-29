'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Receipt,
  Building2,
  User,
  Calendar,
  DollarSign,
  Send,
  CheckCircle,
  XCircle,
  ShoppingCart,
  FileText,
  Printer,
  ExternalLink,
  Clock,
  Edit3,
} from 'lucide-react'
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse } from '@/types'

interface QuoteLineItemDetail {
  id: string
  productName: string
  description: string | null
  specifications: Record<string, string> | null
  quantity: number
  unitPrice: number
  totalPrice: number
  sourceUrl: string | null
  vendorName: string | null
}

interface QuoteDetail {
  id: string
  quoteNumber: string
  totalAmount: number
  status: string
  validUntil: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    type: string
  }
  request: {
    id: string
    subject: string
    status: string
  }
  createdBy: {
    id: string
    name: string
    email: string
  }
  lineItems: QuoteLineItemDetail[]
  purchaseOrder: {
    id: string
    poNumber: string
    status: string
  } | null
}

export default function QuoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [quote, setQuote] = useState<QuoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ status: '', validUntil: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const quoteId = params.id as string

  const fetchQuote = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/quotes/${quoteId}`)
      const result: ApiResponse<QuoteDetail> = await response.json()

      if (result.success && result.data) {
        setQuote(result.data)
      } else {
        setError(result.error || 'Failed to load quote')
      }
    } catch (err) {
      setError('Failed to load quote')
    } finally {
      setLoading(false)
    }
  }, [quoteId])

  useEffect(() => {
    fetchQuote()
  }, [fetchQuote])

  const performAction = async (action: string) => {
    try {
      setActionLoading(action)
      const response = await fetch(`/api/v1/quotes/${quoteId}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchQuote()
      }
    } catch (err) {
      console.error(`Failed to ${action} quote:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)

  const openEditDialog = () => {
    if (!quote) return
    setEditForm({
      status: quote.status,
      validUntil: quote.validUntil ? quote.validUntil.split('T')[0] : '',
    })
    setEditDialogOpen(true)
  }

  const saveEdit = async () => {
    try {
      setSavingEdit(true)
      const payload: Record<string, string> = {}
      if (editForm.status) {
        payload.status = editForm.status
      }
      if (editForm.validUntil) {
        payload.validUntil = editForm.validUntil
      }
      const response = await fetch(`/api/v1/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setEditDialogOpen(false)
        fetchQuote()
      }
    } catch (err) {
      console.error('Failed to update quote:', err)
    } finally {
      setSavingEdit(false)
    }
  }

  const isExpiringSoon = (validUntil: string | null) => {
    if (!validUntil) return false
    const daysUntilExpiry = Math.ceil(
      (new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false
    return new Date(validUntil).getTime() < new Date().getTime()
  }

  if (loading) {
    return <LoadingState message="Loading quote details..." size="lg" />
  }

  if (error || !quote) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/quotes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Quotes
        </Button>
        <EmptyState
          icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
          title="Quote not found"
          description={error || 'The quote you are looking for does not exist.'}
          action={{ label: 'Back to Quotes', onClick: () => router.push('/quotes') }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/quotes')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Quotes
      </Button>

      {/* Quote Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-foreground font-mono">{quote.quoteNumber}</h1>
            <StatusPill status={quote.status} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">
              Created {formatDate(quote.createdAt)} by {quote.createdBy.name}
            </span>
            {quote.validUntil && isExpiringSoon(quote.validUntil) && (
              <Badge variant="destructive">Expires Soon</Badge>
            )}
            {quote.validUntil && isExpired(quote.validUntil) && quote.status !== 'EXPIRED' && (
              <Badge variant="destructive">Past Expiry</Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openEditDialog}>
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {quote.status === 'DRAFT' && (
              <Button
                className="lotus-button"
                onClick={() => performAction('send')}
                disabled={actionLoading === 'send'}
              >
                <Send className="mr-2 h-4 w-4" />
                {actionLoading === 'send' ? 'Sending...' : 'Send Quote'}
              </Button>
            )}
            {quote.status === 'SENT' && (
              <>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => performAction('accept')}
                  disabled={actionLoading === 'accept'}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {actionLoading === 'accept' ? 'Accepting...' : 'Accept'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => performAction('reject')}
                  disabled={actionLoading === 'reject'}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                </Button>
              </>
            )}
            {quote.status === 'ACCEPTED' && !quote.purchaseOrder && (
              <Button
                className="lotus-button"
                onClick={() => performAction('create-po')}
                disabled={actionLoading === 'create-po'}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {actionLoading === 'create-po' ? 'Creating PO...' : 'Create Purchase Order'}
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
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
                <p className="text-2xl font-bold">{formatCurrency(quote.totalAmount)}</p>
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
                <p className="text-2xl font-bold">{quote.lineItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
                <p className="text-2xl font-bold">
                  {quote.validUntil ? formatDate(quote.validUntil) : 'N/A'}
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
                <p className="text-sm font-medium text-muted-foreground">
                  {quote.sentAt ? 'Sent' : 'Last Updated'}
                </p>
                <p className="text-2xl font-bold">
                  {formatRelativeTime(quote.sentAt || quote.updatedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Line Items Table */}
        <Card className="lg:col-span-2 print:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            {quote.lineItems.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="h-8 w-8 text-muted-foreground" />}
                title="No line items"
                description="This quote has no line items."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Product</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Vendor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.productName}</div>
                            {item.specifications && Object.keys(item.specifications).length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {Object.entries(item.specifications).map(([key, value]) => (
                                  <p key={key} className="text-xs text-muted-foreground">
                                    {key}: {value}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.description || '\u2014'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.vendorName && <div>{item.vendorName}</div>}
                            {item.sourceUrl && (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs text-primary hover:underline"
                              >
                                Source <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Grand Total */}
                <div className="mt-4 flex justify-end border-t pt-4">
                  <div className="w-64 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(quote.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-lg font-bold">Grand Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(quote.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6 print:hidden">
          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/clients/${quote.client.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">{quote.client.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{quote.client.type.toLowerCase()}</p>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Linked Request */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/requests/${quote.request.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium truncate">{quote.request.subject}</p>
                  <StatusPill status={quote.request.status} size="sm" />
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Linked Purchase Order */}
          {quote.purchaseOrder && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Purchase Order</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/orders/${quote.purchaseOrder.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors">
                  <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium font-mono">{quote.purchaseOrder.poNumber}</p>
                    <StatusPill status={quote.purchaseOrder.status} size="sm" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Created By */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Created By</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">{quote.createdBy.name}</p>
                  <p className="text-sm text-muted-foreground">{quote.createdBy.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Quote Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[475px]">
          <DialogHeader>
            <DialogTitle>Edit Quote</DialogTitle>
            <DialogDescription>
              Update the status and validity date for this quote.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(val) => setEditForm({ ...editForm, status: val })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-valid-until">Valid Until</Label>
              <Input
                id="edit-valid-until"
                type="date"
                value={editForm.validUntil}
                onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              className="lotus-button"
              onClick={saveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
