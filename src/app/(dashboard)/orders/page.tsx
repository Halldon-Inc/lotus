'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  ShoppingCart,
  Search,
  Filter,
  Package,
  Truck,
  CheckCircle,
  AlertTriangle,
  Eye,
} from 'lucide-react'
import { formatCurrency, formatDate, debounce } from '@/lib/utils'
import Link from 'next/link'

interface PurchaseOrder {
  id: string
  poNumber: string
  totalAmount: number
  status: string
  receivedAt: string
  discrepancyNotes: string | null
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
      subject: string
    }
  }
  verifiedBy: {
    id: string
    name: string
    email: string
  } | null
  itemsProgress: {
    total: number
    pending: number
    sourced: number
    purchased: number
    shipped: number
    received: number
    missing: number
  }
}

interface PurchaseOrdersResponse {
  success: boolean
  data?: {
    items: PurchaseOrder[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'IN_PURCHASING', label: 'In Purchasing' },
  { value: 'PARTIALLY_FULFILLED', label: 'Partially Fulfilled' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'NEEDS_CORRECTION', label: 'Needs Correction' },
  { value: 'RESUBMITTED', label: 'Resubmitted' },
]

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)

  const fetchOrders = async (search: string = '', status: string = 'all', page: number = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        pageSize: '10',
        sortBy: 'receivedAt',
        sortDirection: 'desc',
      })

      if (status !== 'all') {
        params.set('status', status)
      }

      const response = await fetch(`/api/v1/purchase-orders?${params}`)
      const result: PurchaseOrdersResponse = await response.json()

      if (result.success && result.data) {
        setOrders(result.data.items)
        setTotalPages(result.data.totalPages)
        setTotalOrders(result.data.total)
        setCurrentPage(result.data.page)
      } else {
        console.error('Failed to fetch purchase orders:', result.error)
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const debouncedFetchOrders = debounce((search: string, status: string) => {
    fetchOrders(search, status, 1)
  }, 300)

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    if (searchQuery !== '' || statusFilter !== 'all') {
      debouncedFetchOrders(searchQuery, statusFilter)
    } else {
      fetchOrders('', 'all', 1)
    }
  }, [searchQuery, statusFilter])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
  }

  const handlePageChange = (page: number) => {
    fetchOrders(searchQuery, statusFilter, page)
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'RECEIVED': 'bg-yellow-100 text-yellow-800',
      'VERIFIED': 'bg-blue-100 text-blue-800',
      'IN_PURCHASING': 'bg-purple-100 text-purple-800',
      'PARTIALLY_FULFILLED': 'bg-orange-100 text-orange-800',
      'FULFILLED': 'bg-green-100 text-green-800',
      'DELIVERED': 'bg-emerald-100 text-emerald-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getProgressIcon = (progress: PurchaseOrder['itemsProgress']) => {
    if (progress.missing > 0) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    }
    if (progress.received === progress.total) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    if (progress.shipped > 0) {
      return <Truck className="h-4 w-4 text-blue-500" />
    }
    if (progress.purchased > 0) {
      return <Package className="h-4 w-4 text-purple-500" />
    }
    return <ShoppingCart className="h-4 w-4 text-gray-500" />
  }

  const canManageOrders = session?.user.role && ['ADMIN', 'MANAGER', 'OPERATIONS'].includes(session.user.role)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage purchase orders and track fulfillment
          </p>
        </div>
      </div>

      {/* Stats Cards (counts from current page only, not global totals) */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">
                  {orders.filter(o => ['IN_PURCHASING', 'PARTIALLY_FULFILLED'].includes(o.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold">
                  {orders.filter(o => o.status === 'DELIVERED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Issues</p>
                <p className="text-2xl font-bold">
                  {orders.filter(o => o.itemsProgress.missing > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
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

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading purchase orders..." />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="h-8 w-8 text-muted-foreground" />}
              title="No purchase orders found"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'No orders match your current filters'
                  : "No purchase orders have been created yet."
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Quote</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/orders/${order.id}`)}>
                      <TableCell>
                        <div className="font-medium">{order.poNumber}</div>
                        {order.discrepancyNotes && (
                          <div className="text-xs text-amber-600">
                            Has discrepancies
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.client.name}</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {order.client.type.toLowerCase()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{order.quote.quoteNumber}</div>
                          <div className="text-muted-foreground truncate max-w-[200px]">
                            {order.quote.request.subject}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={order.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getProgressIcon(order.itemsProgress)}
                          <div className="text-sm">
                            <div className="font-medium">
                              {order.itemsProgress.received}/{order.itemsProgress.total} received
                            </div>
                            {order.itemsProgress.missing > 0 && (
                              <div className="text-red-600 text-xs">
                                {order.itemsProgress.missing} missing
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatCurrency(order.totalAmount)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(order.receivedAt)}
                        </div>
                        {order.verifiedBy && (
                          <div className="text-xs text-green-600">
                            Verified by {order.verifiedBy.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link href={`/orders/${order.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
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
                    {Math.min(currentPage * 10, totalOrders)} of {totalOrders} orders
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
    </div>
  )
}
