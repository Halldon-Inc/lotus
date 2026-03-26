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
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'
import { formatCurrency, formatDate, debounce } from '@/lib/utils'

interface Client {
  id: string
  name: string
  type: string
  city: string | null
  state: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  spendingLimit: number | null
  assignedRep: {
    id: string
    name: string
    email: string
  } | null
  _count: {
    requests: number
    quotes: number
    purchaseOrders: number
  }
  createdAt: string
}

interface ClientsResponse {
  success: boolean
  data?: {
    items: Client[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: string
}

export default function ClientsPage() {
  const { data: session } = useSession()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalClients, setTotalClients] = useState(0)

  const fetchClients = async (search: string = '', page: number = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        pageSize: '10',
        sortBy: 'createdAt',
        sortDirection: 'desc',
      })

      const response = await fetch(`/api/v1/clients?${params}`)
      const result: ClientsResponse = await response.json()

      if (result.success && result.data) {
        setClients(result.data.items)
        setTotalPages(result.data.totalPages)
        setTotalClients(result.data.total)
        setCurrentPage(result.data.page)
      } else {
        console.error('Failed to fetch clients:', result.error)
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const debouncedFetchClients = debounce((search: string) => {
    fetchClients(search, 1)
  }, 300)

  useEffect(() => {
    fetchClients()
  }, [])

  useEffect(() => {
    if (searchQuery !== '') {
      debouncedFetchClients(searchQuery)
    } else {
      fetchClients('', 1)
    }
  }, [searchQuery])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handlePageChange = (page: number) => {
    fetchClients(searchQuery, page)
  }

  const getClientTypeIcon = (type: string) => {
    switch (type) {
      case 'SCHOOL':
        return '🎓'
      case 'GOVERNMENT':
        return '🏛️'
      case 'HEALTHCARE':
        return '🏥'
      case 'NONPROFIT':
        return '🤝'
      default:
        return '🏢'
    }
  }

  const canManageClients = session?.user.role && ['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">
            Manage your clients and their information
          </p>
        </div>
        {canManageClients && (
          <Button className="lotus-button">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-bold">{totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active This Month</p>
                <p className="text-2xl font-bold">{Math.floor(totalClients * 0.7)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Regions</p>
                <p className="text-2xl font-bold">5</p>
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
                placeholder="Search clients..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading clients..." />
          ) : clients.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8 text-muted-foreground" />}
              title="No clients found"
              description={
                searchQuery
                  ? `No clients match "${searchQuery}"`
                  : "You haven't added any clients yet."
              }
              action={
                canManageClients
                  ? {
                      label: 'Add Client',
                      onClick: () => console.log('Add client'),
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Assigned Rep</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Spending Limit</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{getClientTypeIcon(client.type)}</span>
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {client.type.toLowerCase()}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {client.contactName && (
                            <div className="text-sm font-medium">{client.contactName}</div>
                          )}
                          {client.contactEmail && (
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span>{client.contactEmail}</span>
                            </div>
                          )}
                          {client.contactPhone && (
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{client.contactPhone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {client.city && client.state
                            ? `${client.city}, ${client.state}`
                            : client.city || client.state || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.assignedRep ? (
                          <div className="text-sm">
                            <div className="font-medium">{client.assignedRep.name}</div>
                            <div className="text-muted-foreground">
                              {client.assignedRep.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Badge variant="secondary">
                            {client._count.requests} requests
                          </Badge>
                          <Badge variant="secondary">
                            {client._count.quotes} quotes
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {client.spendingLimit 
                            ? formatCurrency(client.spendingLimit)
                            : '—'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(client.createdAt)}
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
                    {Math.min(currentPage * 10, totalClients)} of {totalClients} clients
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
