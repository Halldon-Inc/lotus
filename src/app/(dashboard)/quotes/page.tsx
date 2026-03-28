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
import { AgingIndicator } from '@/components/shared/aging-indicator'
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  Send,
} from 'lucide-react'
import { formatCurrency, formatDate, formatRelativeTime, debounce } from '@/lib/utils'
import { CreateQuoteDialog } from '@/components/shared/create-quote-dialog'

interface Quote {
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
  }
  createdBy: {
    id: string
    name: string
    email: string
  }
  lineItems: {
    id: string
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }[]
}

interface QuotesResponse {
  success: boolean
  data?: {
    items: Quote[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: string
}

export default function QuotesPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalQuotes, setTotalQuotes] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)

  const fetchQuotes = async (search: string = '', page: number = 1, status: string = 'all') => {
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
        params.append('status', status)
      }

      const response = await fetch(`/api/v1/quotes?${params}`)
      const result: QuotesResponse = await response.json()

      if (result.success && result.data) {
        setQuotes(result.data.items)
        setTotalPages(result.data.totalPages)
        setTotalQuotes(result.data.total)
        setCurrentPage(result.data.page)
      } else {
        console.error('Failed to fetch quotes:', result.error)
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  const debouncedFetchQuotes = debounce((search: string) => {
    fetchQuotes(search, 1, statusFilter)
  }, 300)

  useEffect(() => {
    fetchQuotes()
  }, [])

  useEffect(() => {
    if (searchQuery !== '') {
      debouncedFetchQuotes(searchQuery)
    } else {
      fetchQuotes('', 1, statusFilter)
    }
  }, [searchQuery])

  useEffect(() => {
    fetchQuotes(searchQuery, 1, statusFilter)
  }, [statusFilter])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handlePageChange = (page: number) => {
    fetchQuotes(searchQuery, page, statusFilter)
  }

  const isExpiringSoon = (validUntil: string | null) => {
    if (!validUntil) return false
    const daysUntilExpiry = Math.ceil(
      (new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  const canManageQuotes = session?.user.role && ['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)

  // NOTE: These counts are from the current page only, not global totals.
  // For accurate counts, the API would need to return aggregated status counts.
  const statusCounts = {
    draft: quotes.filter(q => q.status === 'DRAFT').length,
    sent: quotes.filter(q => q.status === 'SENT').length,
    accepted: quotes.filter(q => q.status === 'ACCEPTED').length,
    rejected: quotes.filter(q => q.status === 'REJECTED').length,
    expired: quotes.filter(q => q.status === 'EXPIRED').length,
  }

  const totalValue = quotes.reduce((sum, quote) => sum + quote.totalAmount, 0)
  const pendingValue = quotes
    .filter(q => ['DRAFT', 'SENT'].includes(q.status))
    .reduce((sum, quote) => sum + quote.totalAmount, 0)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quotes</h1>
          <p className="text-muted-foreground">
            Create and manage procurement quotes
          </p>
        </div>
        {canManageQuotes && (
          <Button className="lotus-button" onClick={() => setQuoteDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Quote
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Quotes</p>
                <p className="text-2xl font-bold">{totalQuotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Value</p>
                <p className="text-2xl font-bold">{formatCurrency(pendingValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Send className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sent This Week</p>
                <p className="text-2xl font-bold">{statusCounts.sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card 
          className={statusFilter === 'all' ? 'ring-2 ring-primary' : 'cursor-pointer hover:shadow-md'} 
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">All</p>
              <p className="text-xl font-bold">{totalQuotes}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={statusFilter === 'DRAFT' ? 'ring-2 ring-gray-500' : 'cursor-pointer hover:shadow-md'} 
          onClick={() => setStatusFilter('DRAFT')}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Draft</p>
              <p className="text-xl font-bold">{statusCounts.draft}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={statusFilter === 'SENT' ? 'ring-2 ring-blue-500' : 'cursor-pointer hover:shadow-md'} 
          onClick={() => setStatusFilter('SENT')}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Sent</p>
              <p className="text-xl font-bold">{statusCounts.sent}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={statusFilter === 'ACCEPTED' ? 'ring-2 ring-green-500' : 'cursor-pointer hover:shadow-md'} 
          onClick={() => setStatusFilter('ACCEPTED')}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Accepted</p>
              <p className="text-xl font-bold">{statusCounts.accepted}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={statusFilter === 'REJECTED' ? 'ring-2 ring-red-500' : 'cursor-pointer hover:shadow-md'} 
          onClick={() => setStatusFilter('REJECTED')}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Rejected</p>
              <p className="text-xl font-bold">{statusCounts.rejected}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={statusFilter === 'EXPIRED' ? 'ring-2 ring-orange-500' : 'cursor-pointer hover:shadow-md'} 
          onClick={() => setStatusFilter('EXPIRED')}
        >
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Expired</p>
              <p className="text-xl font-bold">{statusCounts.expired}</p>
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
                placeholder="Search quotes..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quotes Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading quotes..." />
          ) : quotes.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
              title="No quotes found"
              description={
                searchQuery
                  ? `No quotes match "${searchQuery}"`
                  : statusFilter !== 'all'
                  ? `No ${statusFilter.toLowerCase()} quotes found`
                  : "No quotes have been created yet."
              }
              action={
                canManageQuotes
                  ? {
                      label: 'Create Quote',
                      onClick: () => setQuoteDialogOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/quotes/${quote.id}`)}>
                      <TableCell>
                        <div>
                          <div className="font-medium font-mono">{quote.quoteNumber}</div>
                          <div className="text-sm text-muted-foreground">
                            by {quote.createdBy.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{quote.client.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {quote.client.type.toLowerCase()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium truncate max-w-[200px]">
                            {quote.request.subject}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(quote.totalAmount)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <StatusPill status={quote.status} />
                          {isExpiringSoon(quote.validUntil) && (
                            <Badge variant="destructive" className="text-xs">
                              Expires Soon
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <Badge variant="secondary">
                            {quote.lineItems.length} item{quote.lineItems.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {quote.validUntil ? (
                            <div>
                              <div>{formatDate(quote.validUntil)}</div>
                              <div className="text-muted-foreground">
                                {formatRelativeTime(quote.validUntil)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No expiry</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(quote.createdAt)}</div>
                          <AgingIndicator date={quote.createdAt} size="sm" />
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
                    {Math.min(currentPage * 10, totalQuotes)} of {totalQuotes} quotes
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

      <CreateQuoteDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onSuccess={() => fetchQuotes(searchQuery, currentPage, statusFilter)}
      />
    </div>
  )
}
