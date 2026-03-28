'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import { CreateInvoiceDialog } from '@/components/shared/create-invoice-dialog'
import {
  Receipt,
  Plus,
  Search,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Eye,
} from 'lucide-react'
import { formatCurrency, formatDate, debounce } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse } from '@/types'

interface InvoiceListItem {
  id: string
  invoiceNumber: string
  vendorName: string
  totalAmount: number
  status: string
  dueDate: string | null
  receivedAt: string | null
  purchaseOrder: {
    id: string
    poNumber: string
  } | null
  _count: {
    lineItems: number
    matchRecords: number
  }
  createdAt: string
}

interface InvoicesResponse {
  success: boolean
  data?: {
    items: InvoiceListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'PARTIAL', label: 'Partial Match' },
  { value: 'DISPUTED', label: 'Disputed' },
  { value: 'PAID', label: 'Paid' },
]

export default function InvoicesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalInvoices, setTotalInvoices] = useState(0)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const fetchInvoices = async (search: string = '', status: string = 'all', page: number = 1) => {
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

      const response = await fetch(`/api/v1/invoices?${params}`)
      const result: InvoicesResponse = await response.json()

      if (result.success && result.data) {
        setInvoices(result.data.items)
        setTotalPages(result.data.totalPages)
        setTotalInvoices(result.data.total)
        setCurrentPage(result.data.page)
      } else {
        console.error('Failed to fetch invoices:', result.error)
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const debouncedFetch = debounce((search: string, status: string) => {
    fetchInvoices(search, status, 1)
  }, 300)

  useEffect(() => {
    fetchInvoices()
  }, [])

  useEffect(() => {
    if (searchQuery !== '' || statusFilter !== 'all') {
      debouncedFetch(searchQuery, statusFilter)
    } else {
      fetchInvoices('', 'all', 1)
    }
  }, [searchQuery, statusFilter])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handlePageChange = (page: number) => {
    fetchInvoices(searchQuery, statusFilter, page)
  }

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'PAID') return false
    return new Date(dueDate).getTime() < new Date().getTime()
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'].includes(session.user.role)

  // KPI calculations from current page data
  const pendingMatch = invoices.filter(i => i.status === 'PENDING').length
  const matched = invoices.filter(i => i.status === 'MATCHED').length
  const disputed = invoices.filter(i => i.status === 'DISPUTED').length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">
            Manage vendor invoices and match against purchase orders
          </p>
        </div>
        {canManage && (
          <Button className="lotus-button" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{totalInvoices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Match</p>
                <p className="text-2xl font-bold">{pendingMatch}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Matched</p>
                <p className="text-2xl font-bold">{matched}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Disputed</p>
                <p className="text-2xl font-bold">{disputed}</p>
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
                placeholder="Search by invoice number or vendor..."
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

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading invoices..." />
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
              title="No invoices found"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'No invoices match your current filters'
                  : 'No invoices have been created yet.'
              }
              action={
                canManage
                  ? { label: 'Create Invoice', onClick: () => setShowCreateDialog(true) }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>PO Link</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium font-mono">{invoice.invoiceNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {invoice._count.lineItems} item{invoice._count.lineItems !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{invoice.vendorName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatCurrency(invoice.totalAmount)}</div>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={invoice.status} />
                      </TableCell>
                      <TableCell>
                        {invoice.purchaseOrder ? (
                          <Link
                            href={`/orders/${invoice.purchaseOrder.id}`}
                            className="text-sm font-mono text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {invoice.purchaseOrder.poNumber}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unlinked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.dueDate ? (
                          <div>
                            <div className="text-sm">{formatDate(invoice.dueDate)}</div>
                            {isOverdue(invoice.dueDate, invoice.status) && (
                              <Badge variant="destructive" className="text-xs mt-0.5">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(invoice.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/invoices/${invoice.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
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
                    {Math.min(currentPage * 10, totalInvoices)} of {totalInvoices} invoices
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

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => fetchInvoices(searchQuery, statusFilter, currentPage)}
      />
    </div>
  )
}
