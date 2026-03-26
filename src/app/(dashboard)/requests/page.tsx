'use client'

import { useState, useEffect } from 'react'
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
  FileText,
  Plus,
  Search,
  Calendar,
  User,
  Building,
  AlertCircle,
} from 'lucide-react'
import { formatDate, formatRelativeTime, debounce } from '@/lib/utils'

interface Request {
  id: string
  subject: string
  description: string
  source: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    type: string
  }
  assignedTo: {
    id: string
    name: string
    email: string
  } | null
  createdBy: {
    id: string
    name: string
    email: string
  }
  quotes: {
    id: string
    status: string
  }[]
}

interface RequestsResponse {
  success: boolean
  data?: {
    items: Request[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: string
}

export default function RequestsPage() {
  const { data: session } = useSession()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRequests, setTotalRequests] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchRequests = async (search: string = '', page: number = 1, status: string = 'all') => {
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

      const response = await fetch(`/api/v1/requests?${params}`)
      const result: RequestsResponse = await response.json()

      if (result.success && result.data) {
        setRequests(result.data.items)
        setTotalPages(result.data.totalPages)
        setTotalRequests(result.data.total)
        setCurrentPage(result.data.page)
      } else {
        console.error('Failed to fetch requests:', result.error)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const debouncedFetchRequests = debounce((search: string) => {
    fetchRequests(search, 1, statusFilter)
  }, 300)

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    if (searchQuery !== '') {
      debouncedFetchRequests(searchQuery)
    } else {
      fetchRequests('', 1, statusFilter)
    }
  }, [searchQuery])

  useEffect(() => {
    fetchRequests(searchQuery, 1, statusFilter)
  }, [statusFilter])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handlePageChange = (page: number) => {
    fetchRequests(searchQuery, page, statusFilter)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'priority-urgent'
      case 'HIGH':
        return 'priority-high'
      case 'MEDIUM':
        return 'priority-medium'
      default:
        return 'priority-low'
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'EMAIL':
        return '📧'
      case 'HUBSPOT':
        return '🔗'
      default:
        return '✋'
    }
  }

  const canManageRequests = session?.user.role && ['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)

  const statusCounts = {
    new: requests.filter(r => r.status === 'NEW').length,
    assigned: requests.filter(r => r.status === 'ASSIGNED').length,
    inProgress: requests.filter(r => r.status === 'IN_PROGRESS').length,
    quoted: requests.filter(r => r.status === 'QUOTED').length,
    closed: requests.filter(r => r.status === 'CLOSED').length,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Requests</h1>
          <p className="text-muted-foreground">
            Track and manage incoming procurement requests
          </p>
        </div>
        {canManageRequests && (
          <Button className="lotus-button">
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

      {/* Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={statusFilter === 'all' ? 'ring-2 ring-primary' : 'cursor-pointer hover:shadow-md'} onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{totalRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statusFilter === 'NEW' ? 'ring-2 ring-blue-500' : 'cursor-pointer hover:shadow-md'} onClick={() => setStatusFilter('NEW')}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">New</p>
                <p className="text-xl font-bold">{statusCounts.new}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statusFilter === 'ASSIGNED' ? 'ring-2 ring-purple-500' : 'cursor-pointer hover:shadow-md'} onClick={() => setStatusFilter('ASSIGNED')}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assigned</p>
                <p className="text-xl font-bold">{statusCounts.assigned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statusFilter === 'IN_PROGRESS' ? 'ring-2 ring-yellow-500' : 'cursor-pointer hover:shadow-md'} onClick={() => setStatusFilter('IN_PROGRESS')}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-xl font-bold">{statusCounts.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statusFilter === 'QUOTED' ? 'ring-2 ring-indigo-500' : 'cursor-pointer hover:shadow-md'} onClick={() => setStatusFilter('QUOTED')}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-indigo-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quoted</p>
                <p className="text-xl font-bold">{statusCounts.quoted}</p>
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
                placeholder="Search requests..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            <Button
              variant={statusFilter === 'NEW' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('NEW')}
            >
              New
            </Button>
            <Button
              variant={statusFilter === 'ASSIGNED' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('ASSIGNED')}
            >
              Assigned
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading requests..." />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8 text-muted-foreground" />}
              title="No requests found"
              description={
                searchQuery
                  ? `No requests match "${searchQuery}"`
                  : statusFilter !== 'all'
                  ? `No ${statusFilter.toLowerCase()} requests found`
                  : "No requests have been created yet."
              }
              action={
                canManageRequests
                  ? {
                      label: 'Create Request',
                      onClick: () => console.log('Create request'),
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Quotes</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-start space-x-3">
                          <span className="text-lg">{getSourceIcon(request.source)}</span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{request.subject}</div>
                            <div className="text-sm text-muted-foreground line-clamp-2">
                              {request.description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.client.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {request.client.type.toLowerCase()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(request.priority)}>
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={request.status} />
                      </TableCell>
                      <TableCell>
                        {request.assignedTo ? (
                          <div className="text-sm">
                            <div className="font-medium">{request.assignedTo.name}</div>
                            <div className="text-muted-foreground">
                              {request.assignedTo.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {request.quotes.length > 0 ? (
                            <Badge variant="secondary">
                              {request.quotes.length} quote{request.quotes.length !== 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AgingIndicator date={request.createdAt} showText size="sm" />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          <div>{formatDate(request.createdAt)}</div>
                          <div>by {request.createdBy.name}</div>
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
                    {Math.min(currentPage * 10, totalRequests)} of {totalRequests} requests
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
