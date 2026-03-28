'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
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
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ShoppingCart,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Edit,
  Calendar,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PurchaseOrderItem {
  id: string
  quantity: number
  status: string
  sourcedAt: string | null
  sourceUrl: string | null
  vendorName: string | null
  purchasedAt: string | null
  orderNumber: string | null
  expectedDeliveryDate: string | null
  receivedAt: string | null
  receivedQuantity: number
  trackingNumber: string | null
  purchaseOrder: {
    id: string
    poNumber: string
    client: {
      id: string
      name: string
      type: string
    }
    quote: {
      quoteNumber: string
      request: {
        subject: string
        priority: string
      }
    }
  }
  quoteLineItem: {
    productName: string
    description: string | null
    unitPrice: number
  } | null
  sourcedBy: {
    id: string
    name: string
    email: string
  } | null
  purchasedBy: {
    id: string
    name: string
    email: string
  } | null
}

interface ProcurementResponse {
  success: boolean
  data?: {
    items: PurchaseOrderItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    stats: Record<string, number>
  }
  error?: string
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All Items' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SOURCED', label: 'Sourced' },
  { value: 'PURCHASED', label: 'Purchased' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'overdue', label: 'Overdue' },
]

export default function ProcurementPage() {
  const { data: session } = useSession()
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [selectedItem, setSelectedItem] = useState<PurchaseOrderItem | null>(null)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Form state for item updates
  const [formData, setFormData] = useState({
    status: '',
    sourceUrl: '',
    vendorName: '',
    orderNumber: '',
    expectedDeliveryDate: '',
    receivedQuantity: 0,
    trackingNumber: '',
  })

  const fetchItems = async (status: string = 'PENDING', page: number = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status,
        page: page.toString(),
        pageSize: '20',
      })

      const response = await fetch(`/api/v1/procurement?${params}`)
      const result: ProcurementResponse = await response.json()

      if (result.success && result.data) {
        setItems(result.data.items)
        setTotalPages(result.data.totalPages)
        setCurrentPage(result.data.page)
        setStats(result.data.stats)
      } else {
        console.error('Failed to fetch procurement items:', result.error)
      }
    } catch (error) {
      console.error('Error fetching procurement items:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    fetchItems(statusFilter, 1)
  }, [statusFilter])

  const handlePageChange = (page: number) => {
    fetchItems(statusFilter, page)
  }

  const openUpdateDialog = (item: PurchaseOrderItem) => {
    setSelectedItem(item)
    setFormData({
      status: item.status,
      sourceUrl: item.sourceUrl || '',
      vendorName: item.vendorName || '',
      orderNumber: item.orderNumber || '',
      expectedDeliveryDate: item.expectedDeliveryDate 
        ? new Date(item.expectedDeliveryDate).toISOString().split('T')[0] 
        : '',
      receivedQuantity: item.receivedQuantity,
      trackingNumber: item.trackingNumber || '',
    })
    setUpdateDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedItem) return

    try {
      setUpdating(true)
      const updateData: Record<string, unknown> = {}

      // Only include changed fields
      if (formData.status !== selectedItem.status) {
        updateData.status = formData.status
      }
      if (formData.sourceUrl !== (selectedItem.sourceUrl || '')) {
        updateData.sourceUrl = formData.sourceUrl
      }
      if (formData.vendorName !== (selectedItem.vendorName || '')) {
        updateData.vendorName = formData.vendorName
      }
      if (formData.orderNumber !== (selectedItem.orderNumber || '')) {
        updateData.orderNumber = formData.orderNumber
      }
      if (formData.expectedDeliveryDate) {
        updateData.expectedDeliveryDate = formData.expectedDeliveryDate
      }
      if (formData.receivedQuantity !== selectedItem.receivedQuantity) {
        updateData.receivedQuantity = formData.receivedQuantity
      }
      if (formData.trackingNumber !== (selectedItem.trackingNumber || '')) {
        updateData.trackingNumber = formData.trackingNumber
      }

      const response = await fetch(`/api/v1/purchase-order-items/${selectedItem.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      const result = await response.json()

      if (result.success) {
        // Refresh the list
        fetchItems(statusFilter, currentPage)
        setUpdateDialogOpen(false)
        setSelectedItem(null)
      } else {
        console.error('Failed to update item:', result.error)
        alert(result.error || 'Failed to update item')
      }
    } catch (error) {
      console.error('Error updating item:', error)
      alert('Error updating item')
    } finally {
      setUpdating(false)
    }
  }

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      'PENDING': <Clock className="h-4 w-4 text-gray-500" />,
      'SOURCED': <ExternalLink className="h-4 w-4 text-blue-500" />,
      'PURCHASED': <ShoppingCart className="h-4 w-4 text-purple-500" />,
      'SHIPPED': <Truck className="h-4 w-4 text-orange-500" />,
      'RECEIVED': <CheckCircle className="h-4 w-4 text-green-500" />,
      'MISSING': <AlertTriangle className="h-4 w-4 text-red-500" />,
      'CANCELLED': <AlertTriangle className="h-4 w-4 text-gray-500" />,
    }
    return icons[status] || <Package className="h-4 w-4 text-gray-500" />
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'LOW': 'text-green-600',
      'MEDIUM': 'text-yellow-600',
      'HIGH': 'text-orange-600',
      'URGENT': 'text-red-600',
    }
    return colors[priority] || 'text-gray-600'
  }

  const isOverdue = (item: PurchaseOrderItem) => {
    if (!item.expectedDeliveryDate || ['RECEIVED', 'CANCELLED'].includes(item.status)) {
      return false
    }
    return new Date(item.expectedDeliveryDate) < new Date()
  }

  const canManageProcurement = session?.user.role && ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Procurement</h1>
          <p className="text-muted-foreground">
            Manage sourcing, purchasing, and fulfillment workflow
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{stats.PENDING || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ExternalLink className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Sourced</p>
                <p className="text-xl font-bold">{stats.SOURCED || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Purchased</p>
                <p className="text-xl font-bold">{stats.PURCHASED || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Truck className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Shipped</p>
                <p className="text-xl font-bold">{stats.SHIPPED || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Received</p>
                <p className="text-xl font-bold">{stats.RECEIVED || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Issues</p>
                <p className="text-xl font-bold">{(stats.MISSING || 0) + (stats.overdue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Procurement Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading procurement items..." />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="No items found"
              description="No items match your current filter"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className={`cursor-pointer hover:bg-muted/50 ${
                        isOverdue(item) ? 'bg-red-50 border-l-4 border-red-500' : ''
                      }`}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.quoteLineItem?.productName || 'Unknown Item'}</div>
                          <div className="text-sm text-muted-foreground">
                            Qty: {item.quantity} • {formatCurrency(item.quoteLineItem?.unitPrice || 0)} each
                          </div>
                          {item.quoteLineItem?.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {item.quoteLineItem.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{item.purchaseOrder.poNumber}</div>
                          <div className="text-muted-foreground">
                            {item.purchaseOrder.quote.quoteNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.purchaseOrder.client.name}</div>
                          <div className={`text-xs ${getPriorityColor(item.purchaseOrder.quote.request.priority)}`}>
                            {item.purchaseOrder.quote.request.priority} priority
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(item.status)}
                          <StatusPill status={item.status} />
                        </div>
                        {isOverdue(item) && (
                          <div className="text-xs text-red-600 mt-1">Overdue</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {item.sourcedBy && (
                            <div className="text-blue-600">Sourced by {item.sourcedBy.name}</div>
                          )}
                          {item.purchasedBy && (
                            <div className="text-purple-600">Purchased by {item.purchasedBy.name}</div>
                          )}
                          {item.vendorName && (
                            <div className="text-muted-foreground">Vendor: {item.vendorName}</div>
                          )}
                          {item.orderNumber && (
                            <div className="text-muted-foreground">Order: {item.orderNumber}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.expectedDeliveryDate ? (
                          <div className={`text-sm ${isOverdue(item) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            {formatDate(item.expectedDeliveryDate)}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Not set</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManageProcurement && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openUpdateDialog(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center pt-4 space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Update Item Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Item Progress</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Item</Label>
                <div className="text-sm text-muted-foreground">
                  {selectedItem.quoteLineItem?.productName} for {selectedItem.purchaseOrder.client.name}
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="SOURCED">Sourced</SelectItem>
                    <SelectItem value="PURCHASED">Purchased</SelectItem>
                    <SelectItem value="SHIPPED">Shipped</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="MISSING">Missing</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {['SOURCED', 'PURCHASED', 'SHIPPED'].includes(formData.status) && (
                <>
                  <div>
                    <Label htmlFor="sourceUrl">Source URL</Label>
                    <Input
                      id="sourceUrl"
                      value={formData.sourceUrl}
                      onChange={(e) => setFormData({...formData, sourceUrl: e.target.value})}
                      placeholder="Product URL"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vendorName">Vendor</Label>
                    <Input
                      id="vendorName"
                      value={formData.vendorName}
                      onChange={(e) => setFormData({...formData, vendorName: e.target.value})}
                      placeholder="Vendor name"
                    />
                  </div>
                </>
              )}

              {['PURCHASED', 'SHIPPED'].includes(formData.status) && (
                <>
                  <div>
                    <Label htmlFor="orderNumber">Order Number</Label>
                    <Input
                      id="orderNumber"
                      value={formData.orderNumber}
                      onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                      placeholder="Vendor order number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="expectedDeliveryDate">Expected Delivery</Label>
                    <Input
                      id="expectedDeliveryDate"
                      type="date"
                      value={formData.expectedDeliveryDate}
                      onChange={(e) => setFormData({...formData, expectedDeliveryDate: e.target.value})}
                    />
                  </div>
                </>
              )}

              {formData.status === 'SHIPPED' && (
                <div>
                  <Label htmlFor="trackingNumber">Tracking Number</Label>
                  <Input
                    id="trackingNumber"
                    value={formData.trackingNumber}
                    onChange={(e) => setFormData({...formData, trackingNumber: e.target.value})}
                    placeholder="Tracking number"
                  />
                </div>
              )}

              {formData.status === 'RECEIVED' && (
                <div>
                  <Label htmlFor="receivedQuantity">Received Quantity</Label>
                  <Input
                    id="receivedQuantity"
                    type="number"
                    min={0}
                    max={selectedItem.quantity}
                    value={formData.receivedQuantity}
                    onChange={(e) => setFormData({...formData, receivedQuantity: parseInt(e.target.value) || 0})}
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setUpdateDialogOpen(false)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="lotus-button"
                >
                  {updating ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
