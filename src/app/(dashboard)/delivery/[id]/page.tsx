'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Building2,
  MapPin,
  Package,
  CheckCircle,
  AlertTriangle,
  Calendar,
  FileText,
  Printer,
  Upload,
  Clock,
  PackageCheck,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse } from '@/types'

interface ShipmentItem {
  id: string
  quantity: number
  boxNumber: number | null
  purchaseOrderItem: {
    id: string
    quantity: number
    quoteLineItem: {
      productName: string
      description: string | null
      unitPrice: number
    } | null
  }
}

interface ShipmentDetail {
  id: string
  purchaseOrderId: string
  method: string
  carrierName: string | null
  trackingNumber: string | null
  scheduledDate: string | null
  shippedAt: string | null
  deliveredAt: string | null
  podFileUrl: string | null
  podStatus: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  purchaseOrder: {
    id: string
    poNumber: string
    totalAmount: number
    client: {
      id: string
      name: string
      contactName: string | null
      contactEmail: string | null
      contactPhone: string | null
      address: string | null
      city: string | null
      state: string | null
      zip: string | null
      shippingAddress: string | null
      shippingCity: string | null
      shippingState: string | null
      shippingZip: string | null
    }
  }
  items: ShipmentItem[]
}

const STATUS_FLOW = ['PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED'] as const

export default function ShipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Tracking input for Mark Shipped
  const [trackingInput, setTrackingInput] = useState('')
  const [showTrackingForm, setShowTrackingForm] = useState(false)

  // POD upload
  const [podUrl, setPodUrl] = useState('')

  // Failed delivery notes
  const [failedNotes, setFailedNotes] = useState('')

  const shipmentId = params.id as string

  const fetchShipment = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/shipments/${shipmentId}`)
      const result: ApiResponse<ShipmentDetail> = await response.json()

      if (result.success && result.data) {
        setShipment(result.data)
      } else {
        setError(result.error || 'Failed to load shipment')
      }
    } catch {
      setError('Failed to load shipment')
    } finally {
      setLoading(false)
    }
  }, [shipmentId])

  useEffect(() => {
    fetchShipment()
  }, [fetchShipment])

  const updateStatus = async (newStatus: string, extra?: Record<string, string | undefined>) => {
    try {
      setActionLoading(newStatus)
      const body: Record<string, string | undefined> = { status: newStatus, ...extra }
      const response = await fetch(`/api/v1/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setShowTrackingForm(false)
        setTrackingInput('')
        fetchShipment()
      }
    } catch {
      console.error('Failed to update shipment status')
    } finally {
      setActionLoading(null)
    }
  }

  const uploadPod = async () => {
    if (!podUrl.trim()) return
    try {
      setActionLoading('pod')
      const response = await fetch(`/api/v1/shipments/${shipmentId}/pod`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podFileUrl: podUrl.trim() }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setPodUrl('')
        fetchShipment()
      }
    } catch {
      console.error('Failed to upload POD')
    } finally {
      setActionLoading(null)
    }
  }

  const printPackingSlip = () => {
    if (!shipment) return

    const client = shipment.purchaseOrder.client
    const shippingAddr = client.shippingAddress || client.address || ''
    const shippingCity = client.shippingCity || client.city || ''
    const shippingState = client.shippingState || client.state || ''
    const shippingZip = client.shippingZip || client.zip || ''

    const itemRows = shipment.items
      .map(
        (item, idx) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.purchaseOrderItem.quoteLineItem?.productName || 'Item'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.boxNumber || 'N/A'}</td>
        </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html>
<head><title>Packing Slip | ${shipment.purchaseOrder.poNumber}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 3px solid #0D7377; padding-bottom: 16px;">
    <div>
      <h1 style="margin: 0; color: #0D7377; font-size: 24px;">Lotus Connect</h1>
      <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Packing Slip</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0; font-weight: bold; font-size: 16px;">${shipment.purchaseOrder.poNumber}</p>
      <p style="margin: 4px 0 0; color: #666; font-size: 14px;">${shipment.scheduledDate ? formatDate(shipment.scheduledDate) : 'No date set'}</p>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 32px;">
    <div>
      <h3 style="margin: 0 0 8px; color: #0D7377; font-size: 14px; text-transform: uppercase;">Ship To</h3>
      <p style="margin: 0; font-weight: bold;">${client.name}</p>
      ${client.contactName ? `<p style="margin: 2px 0;">${client.contactName}</p>` : ''}
      ${shippingAddr ? `<p style="margin: 2px 0;">${shippingAddr}</p>` : ''}
      ${shippingCity || shippingState || shippingZip ? `<p style="margin: 2px 0;">${[shippingCity, shippingState].filter(Boolean).join(', ')} ${shippingZip}</p>` : ''}
    </div>
    <div style="text-align: right;">
      <h3 style="margin: 0 0 8px; color: #0D7377; font-size: 14px; text-transform: uppercase;">Shipping Details</h3>
      <p style="margin: 2px 0;">Method: ${shipment.method}</p>
      ${shipment.carrierName ? `<p style="margin: 2px 0;">Carrier: ${shipment.carrierName}</p>` : ''}
      ${shipment.trackingNumber ? `<p style="margin: 2px 0;">Tracking: ${shipment.trackingNumber}</p>` : ''}
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">#</th>
        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
        <th style="padding: 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
        <th style="padding: 8px; text-align: center; border-bottom: 2px solid #e5e7eb;">Box #</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; color: #999; font-size: 12px;">
    <p>Lotus Connect Portal | Generated ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER', 'OPERATIONS'].includes(session.user.role)

  if (loading) {
    return <LoadingState message="Loading shipment details..." size="lg" />
  }

  if (error || !shipment) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/delivery')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Delivery
        </Button>
        <EmptyState
          icon={<Truck className="h-8 w-8 text-muted-foreground" />}
          title="Shipment not found"
          description={error || 'The shipment you are looking for does not exist.'}
          action={{ label: 'Back to Delivery', onClick: () => router.push('/delivery') }}
        />
      </div>
    )
  }

  const client = shipment.purchaseOrder.client
  const shippingAddr = client.shippingAddress || client.address
  const shippingCity = client.shippingCity || client.city
  const shippingState = client.shippingState || client.state
  const shippingZip = client.shippingZip || client.zip

  const currentStepIndex = STATUS_FLOW.indexOf(shipment.status as typeof STATUS_FLOW[number])

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/delivery')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Delivery
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-foreground">Shipment</h1>
            <StatusPill status={shipment.status} size="lg" />
            <StatusPill status={shipment.method} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Link href={`/orders/${shipment.purchaseOrder.id}`} className="text-sm text-primary hover:underline font-mono">
              {shipment.purchaseOrder.poNumber}
            </Link>
            <span className="text-sm text-muted-foreground">
              for {client.name}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={printPackingSlip}>
              <Printer className="mr-2 h-4 w-4" />
              Print Packing Slip
            </Button>
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Shipment Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {STATUS_FLOW.map((step, idx) => {
              const isActive = shipment.status === step
              const isComplete = currentStepIndex > idx
              const isFailed = shipment.status === 'FAILED'

              return (
                <div key={step} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isComplete
                          ? 'border-green-500 bg-green-500 text-white'
                          : isActive && !isFailed
                          ? 'border-primary bg-primary text-white'
                          : isFailed && step === shipment.status
                          ? 'border-red-500 bg-red-500 text-white'
                          : 'border-muted-foreground/30 text-muted-foreground'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : isActive && isFailed ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <span className="text-xs font-bold">{idx + 1}</span>
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                      {step.replace('_', ' ')}
                    </span>
                  </div>
                  {idx < STATUS_FLOW.length - 1 && (
                    <div
                      className={`mx-2 h-0.5 flex-1 ${
                        isComplete ? 'bg-green-500' : 'bg-muted-foreground/20'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Status Action Buttons */}
          {canManage && shipment.status !== 'DELIVERED' && shipment.status !== 'FAILED' && (
            <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
              {shipment.status === 'PREPARING' && (
                <Button
                  className="lotus-button"
                  onClick={() => updateStatus('READY')}
                  disabled={actionLoading === 'READY'}
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  {actionLoading === 'READY' ? 'Updating...' : 'Mark Ready'}
                </Button>
              )}
              {shipment.status === 'READY' && (
                <>
                  {showTrackingForm ? (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Enter tracking number"
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        className="w-[250px]"
                      />
                      <Button
                        className="lotus-button"
                        onClick={() => updateStatus('IN_TRANSIT', { trackingNumber: trackingInput || undefined })}
                        disabled={actionLoading === 'IN_TRANSIT'}
                      >
                        {actionLoading === 'IN_TRANSIT' ? 'Shipping...' : 'Confirm Shipped'}
                      </Button>
                      <Button variant="outline" onClick={() => setShowTrackingForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="lotus-button"
                      onClick={() => setShowTrackingForm(true)}
                    >
                      <Truck className="mr-2 h-4 w-4" />
                      Mark Shipped
                    </Button>
                  )}
                </>
              )}
              {shipment.status === 'IN_TRANSIT' && (
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateStatus('DELIVERED')}
                  disabled={actionLoading === 'DELIVERED'}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {actionLoading === 'DELIVERED' ? 'Updating...' : 'Mark Delivered'}
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => updateStatus('FAILED', { notes: failedNotes || undefined })}
                disabled={actionLoading === 'FAILED'}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Mark Failed
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Delivery Investigation */}
      {shipment.status === 'FAILED' && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span>Delivery Failed</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shipment.notes && (
              <p className="text-sm whitespace-pre-wrap">{shipment.notes}</p>
            )}
            {canManage && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Investigation notes..."
                  value={failedNotes}
                  onChange={(e) => setFailedNotes(e.target.value)}
                  rows={3}
                />
                <Button
                  variant="outline"
                  onClick={() => updateStatus('INVESTIGATING', { notes: failedNotes })}
                  disabled={actionLoading === 'INVESTIGATING'}
                >
                  {actionLoading === 'INVESTIGATING' ? 'Saving...' : 'Save Investigation Notes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span>Ship To</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{client.name}</p>
            {client.contactName && <p className="text-sm">{client.contactName}</p>}
            {shippingAddr && <p className="text-sm text-muted-foreground">{shippingAddr}</p>}
            {(shippingCity || shippingState || shippingZip) && (
              <p className="text-sm text-muted-foreground">
                {[shippingCity, shippingState].filter(Boolean).join(', ')} {shippingZip}
              </p>
            )}
            {client.contactPhone && (
              <p className="text-sm text-muted-foreground">{client.contactPhone}</p>
            )}
            {client.contactEmail && (
              <p className="text-sm text-muted-foreground">{client.contactEmail}</p>
            )}
          </CardContent>
        </Card>

        {/* Tracking Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Truck className="h-5 w-5 text-primary" />
              <span>Tracking</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Carrier</p>
              <p className="text-sm font-medium">{shipment.carrierName || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tracking Number</p>
              <p className="text-sm font-mono font-medium">{shipment.trackingNumber || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Scheduled Date</p>
              <p className="text-sm font-medium">
                {shipment.scheduledDate ? formatDate(shipment.scheduledDate) : 'Not set'}
              </p>
            </div>
            {shipment.shippedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Shipped</p>
                <p className="text-sm font-medium">{formatDate(shipment.shippedAt)}</p>
              </div>
            )}
            {shipment.deliveredAt && (
              <div>
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-sm font-medium">{formatDate(shipment.deliveredAt)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* POD Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Proof of Delivery</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusPill status={shipment.podStatus} size="sm" />
            </div>
            {shipment.podFileUrl && (
              <a
                href={shipment.podFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline block"
              >
                View POD Document
              </a>
            )}
            {canManage && shipment.podStatus !== 'VERIFIED' && (
              <div className="space-y-2 border-t pt-3">
                <Input
                  placeholder="POD file URL"
                  value={podUrl}
                  onChange={(e) => setPodUrl(e.target.value)}
                />
                <Button
                  size="sm"
                  className="lotus-button w-full"
                  onClick={uploadPod}
                  disabled={actionLoading === 'pod' || !podUrl.trim()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {actionLoading === 'pod' ? 'Uploading...' : 'Upload POD'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Shipment Items</CardTitle>
        </CardHeader>
        <CardContent>
          {shipment.items.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="No items"
              description="This shipment has no items assigned."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-center">Box #</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipment.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.purchaseOrderItem.quoteLineItem?.productName || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.purchaseOrderItem.quoteLineItem?.description || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                      <TableCell className="text-center">
                        {item.boxNumber || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.purchaseOrderItem.quoteLineItem
                          ? formatCurrency(item.purchaseOrderItem.quoteLineItem.unitPrice)
                          : 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linked Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link
            href={`/orders/${shipment.purchaseOrder.id}`}
            className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
          >
            <Package className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Purchase Order</p>
              <p className="font-medium font-mono">{shipment.purchaseOrder.poNumber}</p>
            </div>
          </Link>
          <Link
            href={`/clients/${client.id}`}
            className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
          >
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{client.name}</p>
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
