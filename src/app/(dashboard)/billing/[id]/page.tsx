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
import {
  ArrowLeft,
  Receipt,
  Building2,
  DollarSign,
  Send,
  CheckCircle,
  Printer,
  Package,
  ShoppingCart,
  FileText,
  Calendar,
  Shield,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse } from '@/types'

interface InvoiceLineItem {
  productName: string
  description: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface ClientInvoiceDetail {
  id: string
  invoiceNumber: string
  totalAmount: number
  status: string
  sentAt: string | null
  paidAt: string | null
  dueDate: string | null
  podVerified: boolean
  notes: string | null
  createdAt: string
  purchaseOrder: {
    id: string
    poNumber: string
    totalAmount: number
    status: string
    items: {
      quantity: number
      quoteLineItem: {
        productName: string
        description: string | null
        unitPrice: number
        totalPrice: number
      } | null
    }[]
  }
  client: {
    id: string
    name: string
    type: string
    contactName: string | null
    contactEmail: string | null
    contactPhone: string | null
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
  }
}

export default function BillingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [invoice, setInvoice] = useState<ClientInvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const invoiceId = params.id as string

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/client-invoices/${invoiceId}`)
      const result: ApiResponse<ClientInvoiceDetail> = await response.json()

      if (result.success && result.data) {
        setInvoice(result.data)
      } else {
        setError(result.error || 'Failed to load invoice')
      }
    } catch {
      setError('Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [invoiceId])

  useEffect(() => {
    fetchInvoice()
  }, [fetchInvoice])

  const performAction = async (action: string, body?: Record<string, string>) => {
    try {
      setActionLoading(action)
      const response = await fetch(`/api/v1/client-invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchInvoice()
      }
    } catch {
      console.error(`Failed to ${action} invoice`)
    } finally {
      setActionLoading(null)
    }
  }

  const sendInvoice = () => {
    // Set due date to 30 days from now
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)
    performAction('send', { status: 'SENT', dueDate: dueDate.toISOString() })
  }

  const markPaid = () => {
    performAction('paid', { status: 'PAID' })
  }

  const printInvoice = () => {
    if (!invoice) return

    const lineItems = invoice.purchaseOrder.items
      .filter((item) => item.quoteLineItem)
      .map((item, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 500;">${item.quoteLineItem!.productName}</div>
            ${item.quoteLineItem!.description ? `<div style="font-size: 12px; color: #666;">${item.quoteLineItem!.description}</div>` : ''}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.quoteLineItem!.unitPrice.toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">$${item.quoteLineItem!.totalPrice.toFixed(2)}</td>
        </tr>`
      ).join('')

    const html = `<!DOCTYPE html>
<html>
<head><title>Invoice ${invoice.invoiceNumber}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
    <div>
      <h1 style="margin: 0; color: #0D7377; font-size: 28px;">Lotus Connect</h1>
      <p style="margin: 4px 0 0; color: #666;">Procurement Solutions</p>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0; font-size: 24px; color: #333;">INVOICE</h2>
      <p style="margin: 4px 0 0; font-size: 16px; font-weight: bold; font-family: monospace;">${invoice.invoiceNumber}</p>
      <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Date: ${formatDate(invoice.createdAt)}</p>
      ${invoice.dueDate ? `<p style="margin: 4px 0 0; color: #666; font-size: 14px;">Due: ${formatDate(invoice.dueDate)}</p>` : ''}
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 32px; padding: 20px; background: #f9fafb; border-radius: 8px;">
    <div>
      <h3 style="margin: 0 0 8px; color: #0D7377; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Bill To</h3>
      <p style="margin: 0; font-weight: bold; font-size: 16px;">${invoice.client.name}</p>
      ${invoice.client.contactName ? `<p style="margin: 4px 0 0;">${invoice.client.contactName}</p>` : ''}
      ${invoice.client.address ? `<p style="margin: 2px 0 0; color: #666;">${invoice.client.address}</p>` : ''}
      ${invoice.client.city || invoice.client.state ? `<p style="margin: 2px 0 0; color: #666;">${[invoice.client.city, invoice.client.state].filter(Boolean).join(', ')} ${invoice.client.zip || ''}</p>` : ''}
    </div>
    <div style="text-align: right;">
      <h3 style="margin: 0 0 8px; color: #0D7377; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Reference</h3>
      <p style="margin: 0; font-family: monospace;">PO: ${invoice.purchaseOrder.poNumber}</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <thead>
      <tr style="background: #0D7377; color: white;">
        <th style="padding: 10px; text-align: left; font-size: 13px;">#</th>
        <th style="padding: 10px; text-align: left; font-size: 13px;">Description</th>
        <th style="padding: 10px; text-align: center; font-size: 13px;">Qty</th>
        <th style="padding: 10px; text-align: right; font-size: 13px;">Unit Price</th>
        <th style="padding: 10px; text-align: right; font-size: 13px;">Total</th>
      </tr>
    </thead>
    <tbody>${lineItems}</tbody>
  </table>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
    <div style="width: 280px;">
      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
        <span style="color: #666;">Subtotal</span>
        <span>$${invoice.totalAmount.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #0D7377; margin-top: 8px;">
        <span style="font-size: 18px; font-weight: bold;">Total Due</span>
        <span style="font-size: 18px; font-weight: bold; color: #0D7377;">$${invoice.totalAmount.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
    <p>Thank you for your business!</p>
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

  const canManage = session?.user.role && ['ADMIN', 'MANAGER'].includes(session.user.role)

  if (loading) {
    return <LoadingState message="Loading invoice..." size="lg" />
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/billing')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Billing
        </Button>
        <EmptyState
          icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
          title="Invoice not found"
          description={error || 'The invoice you are looking for does not exist.'}
          action={{ label: 'Back to Billing', onClick: () => router.push('/billing') }}
        />
      </div>
    )
  }

  const isOverdue = invoice.status === 'SENT' && invoice.dueDate && new Date(invoice.dueDate) < new Date()

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/billing')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Billing
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-foreground font-mono">{invoice.invoiceNumber}</h1>
            <StatusPill status={isOverdue ? 'OVERDUE' : invoice.status} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">
              Created {formatDate(invoice.createdAt)}
            </span>
            {invoice.podVerified && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Shield className="mr-1 h-3 w-3" />
                POD Verified
              </Badge>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {invoice.status === 'DRAFT' && (
              <Button
                className="lotus-button"
                onClick={sendInvoice}
                disabled={actionLoading === 'send'}
              >
                <Send className="mr-2 h-4 w-4" />
                {actionLoading === 'send' ? 'Sending...' : 'Send Invoice'}
              </Button>
            )}
            {(invoice.status === 'SENT' || isOverdue) && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={markPaid}
                disabled={actionLoading === 'paid'}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {actionLoading === 'paid' ? 'Processing...' : 'Mark Paid'}
              </Button>
            )}
            <Button variant="outline" onClick={printInvoice}>
              <Printer className="mr-2 h-4 w-4" />
              Print Invoice
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
                <p className="text-2xl font-bold">{formatCurrency(invoice.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Send className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">
                  {invoice.sentAt ? formatDate(invoice.sentAt) : 'Not sent'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={isOverdue ? 'border-red-200' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                <p className={`text-2xl font-bold ${isOverdue ? 'text-red-600' : ''}`}>
                  {invoice.dueDate ? formatDate(invoice.dueDate) : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold">
                  {invoice.paidAt ? formatDate(invoice.paidAt) : 'Unpaid'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Line Items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.purchaseOrder.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {item.quoteLineItem?.productName || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.quoteLineItem?.description || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {item.quoteLineItem ? formatCurrency(item.quoteLineItem.unitPrice) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quoteLineItem ? formatCurrency(item.quoteLineItem.totalPrice) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end border-t pt-4">
              <div className="w-64 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-lg font-bold">Grand Total</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/clients/${invoice.client.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">{invoice.client.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{invoice.client.type.toLowerCase()}</p>
                </div>
              </Link>
              {invoice.client.contactName && (
                <p className="text-sm">{invoice.client.contactName}</p>
              )}
              {invoice.client.contactEmail && (
                <p className="text-sm text-muted-foreground">{invoice.client.contactEmail}</p>
              )}
              {invoice.client.address && (
                <p className="text-sm text-muted-foreground">
                  {invoice.client.address}, {[invoice.client.city, invoice.client.state].filter(Boolean).join(', ')} {invoice.client.zip}
                </p>
              )}
            </CardContent>
          </Card>

          {/* PO Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Purchase Order</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/orders/${invoice.purchaseOrder.id}`} className="flex items-center space-x-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors">
                <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-mono font-medium">{invoice.purchaseOrder.poNumber}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusPill status={invoice.purchaseOrder.status} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {invoice.purchaseOrder.items.length} items
                    </span>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Delivery Confirmation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">POD Verified:</span>
                {invoice.podVerified ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                    No
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
