'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  ShoppingCart,
  Building2,
  User,
  Calendar,
  DollarSign,
  Package,
  Truck,
  CheckCircle,
  AlertTriangle,
  Receipt,
  FileText,
  ClipboardCheck,
  Clock,
  ExternalLink,
  MessageSquare,
  Plus,
  PackageCheck,
  RotateCcw,
  XCircle,
  Paperclip,
  Trash2,
  Download,
} from 'lucide-react'
import { formatCurrency, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse, NoteWithUser } from '@/types'

interface POItemDetail {
  id: string
  quantity: number
  status: string
  vendorName: string | null
  sourceUrl: string | null
  orderNumber: string | null
  trackingNumber: string | null
  expectedDeliveryDate: string | null
  receivedAt: string | null
  receivedQuantity: number
  quoteLineItem: {
    id: string
    productName: string
    description: string | null
    unitPrice: number
    totalPrice: number
  } | null
  sourcedBy: { id: string; name: string } | null
  purchasedBy: { id: string; name: string } | null
}

interface PODetail {
  id: string
  poNumber: string
  totalAmount: number
  status: string
  receivedAt: string
  discrepancyNotes: string | null
  rejectionReason: string | null
  rejectionCount: number
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    type: string
  }
  quote: {
    id: string
    quoteNumber: string
    totalAmount: number
    request: {
      id: string
      subject: string
    }
  }
  verifiedBy: {
    id: string
    name: string
    email: string
  } | null
  items: POItemDetail[]
  notes: NoteWithUser[]
}

interface AttachmentRecord {
  id: string
  entityType: string
  entityId: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  uploadedById: string
  createdAt: string
  uploadedBy: {
    id: string
    name: string
    email: string
  }
}

const ITEM_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'SOURCED', label: 'Sourced' },
  { value: 'PURCHASED', label: 'Purchased' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const ITEM_STATUS_FLOW = ['PENDING', 'SOURCED', 'PURCHASED', 'SHIPPED', 'RECEIVED'] as const

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [order, setOrder] = useState<PODetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([])
  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachFileName, setAttachFileName] = useState('')
  const [attachFileUrl, setAttachFileUrl] = useState('')
  const [attachNotes, setAttachNotes] = useState('')
  const [attachingFile, setAttachingFile] = useState(false)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)

  const orderId = params.id as string

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/purchase-orders/${orderId}`)
      const result: ApiResponse<PODetail> = await response.json()

      if (result.success && result.data) {
        setOrder(result.data)
      } else {
        setError(result.error || 'Failed to load purchase order')
      }
    } catch (err) {
      setError('Failed to load purchase order')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  const fetchAttachments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/attachments?entityType=PURCHASE_ORDER&entityId=${orderId}`
      )
      const result: ApiResponse<{ items: AttachmentRecord[] }> = await response.json()
      if (result.success && result.data) {
        setAttachments(result.data.items)
      }
    } catch (err) {
      console.error('Failed to load attachments:', err)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
    fetchAttachments()
  }, [fetchOrder, fetchAttachments])

  const addAttachment = async () => {
    if (!attachFileName.trim() || !attachFileUrl.trim()) return
    try {
      setAttachingFile(true)
      const body: Record<string, unknown> = {
        entityType: 'PURCHASE_ORDER',
        entityId: orderId,
        fileName: attachFileName.trim(),
        fileUrl: attachFileUrl.trim(),
      }
      // If the user entered notes, append them to the file name for reference
      // (notes are informational only, stored as part of the file name)
      if (attachNotes.trim()) {
        body.fileName = `${attachFileName.trim()} [${attachNotes.trim()}]`
      }
      const response = await fetch('/api/v1/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setAttachDialogOpen(false)
        setAttachFileName('')
        setAttachFileUrl('')
        setAttachNotes('')
        fetchAttachments()
      }
    } catch (err) {
      console.error('Failed to add attachment:', err)
    } finally {
      setAttachingFile(false)
    }
  }

  const deleteAttachment = async (attachmentId: string) => {
    try {
      setDeletingAttachmentId(attachmentId)
      const response = await fetch(`/api/v1/attachments/${attachmentId}`, {
        method: 'DELETE',
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchAttachments()
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err)
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const verifyOrder = async () => {
    try {
      setVerifying(true)
      const response = await fetch(`/api/v1/purchase-orders/${orderId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchOrder()
      }
    } catch (err) {
      console.error('Failed to verify order:', err)
    } finally {
      setVerifying(false)
    }
  }

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    try {
      setUpdatingItemId(itemId)
      const response = await fetch(`/api/v1/purchase-orders/${orderId}/items/${itemId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchOrder()
      }
    } catch (err) {
      console.error('Failed to update item status:', err)
    } finally {
      setUpdatingItemId(null)
    }
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    try {
      setAddingNote(true)
      const response = await fetch('/api/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'PURCHASE_ORDER',
          entityId: orderId,
          content: newNote.trim(),
        }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setNewNote('')
        fetchOrder()
      }
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setAddingNote(false)
    }
  }

  const returnForCorrection = async () => {
    if (!rejectionReason.trim()) return
    try {
      setRejecting(true)
      const response = await fetch(`/api/v1/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'NEEDS_CORRECTION',
          rejectionReason: rejectionReason.trim(),
        }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setRejectionDialogOpen(false)
        setRejectionReason('')
        fetchOrder()
      }
    } catch {
      console.error('Failed to return PO for correction')
    } finally {
      setRejecting(false)
    }
  }

  const resubmitOrder = async () => {
    try {
      setResubmitting(true)
      const response = await fetch(`/api/v1/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESUBMITTED' }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchOrder()
      }
    } catch {
      console.error('Failed to resubmit PO')
    } finally {
      setResubmitting(false)
    }
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER', 'OPERATIONS', 'PROCUREMENT'].includes(session.user.role)
  const canReject = session?.user.role && ['ADMIN', 'MANAGER', 'OPERATIONS'].includes(session.user.role)
  const canResubmit = session?.user.role === 'SALES'

  const getItemStatusIcon = (status: string) => {
    switch (status) {
      case 'RECEIVED': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'SHIPPED': return <Truck className="h-4 w-4 text-blue-500" />
      case 'PURCHASED': return <Package className="h-4 w-4 text-purple-500" />
      case 'SOURCED': return <ClipboardCheck className="h-4 w-4 text-teal-500" />
      case 'MISSING': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'CANCELLED': return <AlertTriangle className="h-4 w-4 text-gray-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  if (loading) {
    return <LoadingState message="Loading purchase order..." size="lg" />
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
        <EmptyState
          icon={<ShoppingCart className="h-8 w-8 text-muted-foreground" />}
          title="Purchase order not found"
          description={error || 'The purchase order you are looking for does not exist.'}
          action={{ label: 'Back to Orders', onClick: () => router.push('/orders') }}
        />
      </div>
    )
  }

  const totalItems = order.items.length
  const receivedItems = order.items.filter(i => i.status === 'RECEIVED').length
  const missingItems = order.items.filter(i => i.status === 'MISSING').length
  const fulfillmentPercent = totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0

  const hasQuantityDiscrepancy = order.items.some(
    (item) => item.status === 'RECEIVED' && item.receivedQuantity !== item.quantity
  )

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/orders')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Orders
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-foreground font-mono">{order.poNumber}</h1>
            <StatusPill status={order.status} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">
              Received {formatDate(order.receivedAt)}
            </span>
            {order.verifiedBy && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Verified by {order.verifiedBy.name}
              </Badge>
            )}
            {missingItems > 0 && (
              <Badge variant="destructive">{missingItems} missing item{missingItems !== 1 ? 's' : ''}</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage && !order.verifiedBy && order.status !== 'NEEDS_CORRECTION' && (
            <Button
              className="lotus-button"
              onClick={verifyOrder}
              disabled={verifying}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {verifying ? 'Verifying...' : 'Verify PO'}
            </Button>
          )}
          {canReject && order.status !== 'NEEDS_CORRECTION' && order.status !== 'FULFILLED' && order.status !== 'DELIVERED' && (
            <Button
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => setRejectionDialogOpen(true)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Return for Correction
            </Button>
          )}
          {canResubmit && order.status === 'NEEDS_CORRECTION' && (
            <Button
              className="lotus-button"
              onClick={resubmitOrder}
              disabled={resubmitting}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {resubmitting ? 'Resubmitting...' : 'Resubmit PO'}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/receiving?po=${order.poNumber}`}>
              <PackageCheck className="mr-2 h-4 w-4" />
              Go to Receiving
            </Link>
          </Button>
        </div>
      </div>

      {/* Rejection Banner */}
      {order.rejectionReason && (order.status === 'NEEDS_CORRECTION' || order.rejectionCount > 0) && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <XCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-orange-800">
                    {order.status === 'NEEDS_CORRECTION' ? 'Returned for Correction' : 'Previously Returned'}
                  </p>
                  {order.rejectionCount > 1 && (
                    <Badge variant="secondary" className="bg-orange-200 text-orange-800 text-xs">
                      Returned {order.rejectionCount}x
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-orange-700 whitespace-pre-wrap">{order.rejectionReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fulfillment Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fulfillment Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {receivedItems} of {totalItems} items received
              </span>
              <span className="font-bold text-primary">{fulfillmentPercent}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  fulfillmentPercent === 100
                    ? 'bg-green-500'
                    : missingItems > 0
                    ? 'bg-amber-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${fulfillmentPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{order.items.filter(i => i.status === 'PENDING').length} pending</span>
              <span>{order.items.filter(i => i.status === 'SOURCED').length} sourced</span>
              <span>{order.items.filter(i => i.status === 'PURCHASED').length} purchased</span>
              <span>{order.items.filter(i => i.status === 'SHIPPED').length} shipped</span>
              <span className="text-green-600 font-medium">{receivedItems} received</span>
              {missingItems > 0 && <span className="text-red-600 font-medium">{missingItems} missing</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Schedule */}
      {(() => {
        const now = new Date()
        const itemsWithDates = order.items.filter((i) => i.expectedDeliveryDate && i.status !== 'RECEIVED' && i.status !== 'CANCELLED')
        const overdueDeliveries = itemsWithDates.filter((i) => new Date(i.expectedDeliveryDate!) < now)
        const upcomingDeliveries = itemsWithDates.filter((i) => new Date(i.expectedDeliveryDate!) >= now)

        // Group by date
        const groupByDate = (items: POItemDetail[]) => {
          const groups: Record<string, POItemDetail[]> = {}
          for (const item of items) {
            const date = item.expectedDeliveryDate ? formatDate(item.expectedDeliveryDate) : 'No date'
            if (!groups[date]) groups[date] = []
            groups[date].push(item)
          }
          return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
        }

        if (itemsWithDates.length === 0 && order.items.every((i) => i.status === 'RECEIVED' || i.status === 'CANCELLED')) {
          return null
        }

        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span>Delivery Schedule</span>
                </CardTitle>
                {overdueDeliveries.length > 0 && (
                  <Badge variant="destructive">
                    {overdueDeliveries.length} overdue
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {itemsWithDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No delivery dates set for pending items.</p>
              ) : (
                <div className="space-y-4">
                  {/* Overdue */}
                  {overdueDeliveries.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center space-x-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Overdue</span>
                      </h4>
                      <div className="space-y-2">
                        {groupByDate(overdueDeliveries).map(([date, items]) => (
                          <div key={date} className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                            <p className="text-xs font-medium text-red-700 mb-1">{date}</p>
                            {items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between py-1">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {item.quoteLineItem?.productName || 'Unknown Product'}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {item.vendorName && <span>{item.vendorName}</span>}
                                    {item.trackingNumber && (
                                      <span className="font-mono">{item.trackingNumber}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <StatusPill status={item.status} size="sm" />
                                  <span className="text-xs text-muted-foreground">
                                    {item.receivedQuantity}/{item.quantity}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming */}
                  {upcomingDeliveries.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center space-x-1">
                        <Truck className="h-4 w-4" />
                        <span>Upcoming</span>
                      </h4>
                      <div className="space-y-2">
                        {groupByDate(upcomingDeliveries).map(([date, items]) => (
                          <div key={date} className="rounded-lg border p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">{date}</p>
                            {items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between py-1">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {item.quoteLineItem?.productName || 'Unknown Product'}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {item.vendorName && <span>{item.vendorName}</span>}
                                    {item.trackingNumber && (
                                      <span className="font-mono">{item.trackingNumber}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <StatusPill status={item.status} size="sm" />
                                  <span className="text-xs text-muted-foreground">
                                    {item.receivedQuantity}/{item.quantity}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(order.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Received</p>
                <p className="text-2xl font-bold">{receivedItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Missing</p>
                <p className="text-2xl font-bold">{missingItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          {order.items.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="No items"
              description="This purchase order has no items."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    {canManage && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const hasDiscrepancy = item.status === 'RECEIVED' && item.receivedQuantity !== item.quantity

                    return (
                      <TableRow key={item.id} className={hasDiscrepancy ? 'bg-amber-50' : ''}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {item.quoteLineItem?.productName || 'Unknown Product'}
                            </div>
                            {item.quoteLineItem?.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {item.quoteLineItem.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getItemStatusIcon(item.status)}
                            <StatusPill status={item.status} size="sm" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${hasDiscrepancy ? 'text-amber-600' : ''}`}>
                            {item.receivedQuantity}
                          </span>
                          {hasDiscrepancy && (
                            <div className="text-xs text-amber-600">
                              Discrepancy
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.vendorName || '\u2014'}
                            {item.sourceUrl && (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs text-primary hover:underline"
                              >
                                Source <ExternalLink className="inline h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono">
                            {item.trackingNumber || '\u2014'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {item.expectedDeliveryDate
                              ? formatDate(item.expectedDeliveryDate)
                              : '\u2014'
                            }
                          </div>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Select
                              value={item.status}
                              onValueChange={(val) => updateItemStatus(item.id, val)}
                              disabled={updatingItemId === item.id}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ITEM_STATUS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Discrepancy Notes */}
        {(order.discrepancyNotes || hasQuantityDiscrepancy) && (
          <Card className="lg:col-span-2 border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Discrepancy Notes</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.discrepancyNotes ? (
                <p className="text-sm whitespace-pre-wrap">{order.discrepancyNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Some items have quantity discrepancies between expected and received amounts.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Linked Entities */}
        <div className={`space-y-6 ${order.discrepancyNotes || hasQuantityDiscrepancy ? '' : 'lg:col-span-1'}`}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Linked Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href={`/clients/${order.client.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="font-medium">{order.client.name}</p>
                </div>
              </Link>
              <Link href={`/quotes/${order.quote.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                <Receipt className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Quote</p>
                  <p className="font-medium font-mono">{order.quote.quoteNumber}</p>
                </div>
              </Link>
              <Link href={`/requests/${order.quote.request.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Request</p>
                  <p className="font-medium truncate">{order.quote.request.subject}</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        <Card className={`${order.discrepancyNotes || hasQuantityDiscrepancy ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Textarea
                placeholder="Add a note about this purchase order..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  className="lotus-button"
                  size="sm"
                  onClick={addNote}
                  disabled={addingNote || !newNote.trim()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {addingNote ? 'Adding...' : 'Add Note'}
                </Button>
              </div>
            </div>

            {!order.notes || order.notes.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6 text-muted-foreground" />}
                title="No notes"
                description="Add a note to track discrepancies or important details."
                className="py-6"
              />
            ) : (
              <div className="space-y-3">
                {order.notes.map((note) => (
                  <div key={note.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {getInitials(note.user.name || 'U')}
                        </div>
                        <span className="text-sm font-medium">{note.user.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(note.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Paperclip className="h-5 w-5 text-primary" />
              <span>Attachments</span>
              {attachments.length > 0 && (
                <Badge variant="secondary" className="ml-2">{attachments.length}</Badge>
              )}
            </CardTitle>
            <Button
              className="lotus-button"
              size="sm"
              onClick={() => setAttachDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Attach File
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <EmptyState
              icon={<Paperclip className="h-6 w-6 text-muted-foreground" />}
              title="No attachments"
              description="Attach documents, receipts, or other files to this purchase order."
              className="py-6"
            />
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => {
                const canDelete =
                  session?.user.role &&
                  (['ADMIN', 'MANAGER'].includes(session.user.role) ||
                    attachment.uploadedById === session.user.id)

                return (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Uploaded by {attachment.uploadedBy.name}</span>
                          <span>{formatDate(attachment.createdAt)}</span>
                          {attachment.fileSize && (
                            <span>{(attachment.fileSize / 1024).toFixed(1)} KB</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteAttachment(attachment.id)}
                          disabled={deletingAttachmentId === attachment.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attach File Dialog */}
      <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a reference to an external file or document. Cloud upload support coming soon.
            </p>
            <div className="space-y-2">
              <Label htmlFor="attach-file-name">File Name</Label>
              <Input
                id="attach-file-name"
                placeholder="Invoice_2026_03.pdf"
                value={attachFileName}
                onChange={(e) => setAttachFileName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attach-file-url">File URL</Label>
              <Input
                id="attach-file-url"
                placeholder="https://drive.google.com/file/d/..."
                value={attachFileUrl}
                onChange={(e) => setAttachFileUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attach-notes">Notes (optional)</Label>
              <Textarea
                id="attach-notes"
                placeholder="Any additional context about this file..."
                value={attachNotes}
                onChange={(e) => setAttachNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAttachDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="lotus-button"
                onClick={addAttachment}
                disabled={attachingFile || !attachFileName.trim() || !attachFileUrl.trim()}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                {attachingFile ? 'Attaching...' : 'Attach'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return for Correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Explain what needs to be corrected on this purchase order. The sales team will be able to see this and resubmit.
            </p>
            <Textarea
              placeholder="Describe the issues that need correction..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={returnForCorrection}
                disabled={rejecting || !rejectionReason.trim()}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {rejecting ? 'Returning...' : 'Return for Correction'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
