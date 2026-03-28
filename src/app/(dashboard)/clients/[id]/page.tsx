'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Edit3,
  X,
  Check,
  FileText,
  Receipt,
  ShoppingCart,
  Clock,
  MessageSquare,
  Plus,
} from 'lucide-react'
import { formatCurrency, formatDate, formatRelativeTime, getInitials } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse, NoteWithUser, ActivityLogWithUser } from '@/types'

interface ClientDetail {
  id: string
  name: string
  type: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  fiscalYearStart: string | null
  spendingLimit: number | null
  assignedRep: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  requests: {
    id: string
    subject: string
    status: string
    priority: string
    createdAt: string
  }[]
  quotes: {
    id: string
    quoteNumber: string
    totalAmount: number
    status: string
    createdAt: string
  }[]
  purchaseOrders: {
    id: string
    poNumber: string
    totalAmount: number
    status: string
    receivedAt: string
  }[]
  notes: NoteWithUser[]
  activityLogs: ActivityLogWithUser[]
  createdAt: string
  updatedAt: string
}

type TabKey = 'requests' | 'quotes' | 'orders' | 'activity' | 'notes'

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('requests')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string | number | null>>({})
  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  const clientId = params.id as string

  const fetchClient = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/clients/${clientId}`)
      const result: ApiResponse<ClientDetail> = await response.json()

      if (result.success && result.data) {
        setClient(result.data)
      } else {
        setError(result.error || 'Failed to load client')
      }
    } catch (err) {
      setError('Failed to load client')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  const startEditing = () => {
    if (!client) return
    setEditForm({
      name: client.name,
      type: client.type,
      contactName: client.contactName || '',
      contactEmail: client.contactEmail || '',
      contactPhone: client.contactPhone || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      zip: client.zip || '',
      spendingLimit: client.spendingLimit,
    })
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditForm({})
  }

  const saveChanges = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/v1/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const result: ApiResponse<ClientDetail> = await response.json()

      if (result.success) {
        await fetchClient()
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Failed to save client:', err)
    } finally {
      setSaving(false)
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
          entityType: 'CLIENT',
          entityId: clientId,
          content: newNote.trim(),
        }),
      })
      const result: ApiResponse = await response.json()

      if (result.success) {
        setNewNote('')
        fetchClient()
      }
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setAddingNote(false)
    }
  }

  const getClientTypeIcon = (type: string) => {
    switch (type) {
      case 'SCHOOL': return '🎓'
      case 'GOVERNMENT': return '🏛️'
      case 'HEALTHCARE': return '🏥'
      case 'NONPROFIT': return '🤝'
      default: return '🏢'
    }
  }

  const canEdit = session?.user.role && ['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)

  if (loading) {
    return <LoadingState message="Loading client details..." size="lg" />
  }

  if (error || !client) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/clients')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
        <EmptyState
          icon={<Building2 className="h-8 w-8 text-muted-foreground" />}
          title="Client not found"
          description={error || 'The client you are looking for does not exist.'}
          action={{ label: 'Back to Clients', onClick: () => router.push('/clients') }}
        />
      </div>
    )
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'requests', label: 'Requests', count: client.requests.length },
    { key: 'quotes', label: 'Quotes', count: client.quotes.length },
    { key: 'orders', label: 'Purchase Orders', count: client.purchaseOrders.length },
    { key: 'activity', label: 'Activity', count: client.activityLogs?.length || 0 },
    { key: 'notes', label: 'Notes', count: client.notes?.length || 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/clients')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Clients
      </Button>

      {/* Client Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-3xl">
            {getClientTypeIcon(client.type)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
            <div className="flex items-center space-x-3 mt-1">
              <Badge variant="secondary" className="capitalize">
                {client.type.toLowerCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Client since {formatDate(client.createdAt)}
              </span>
            </div>
          </div>
        </div>
        {canEdit && !isEditing && (
          <Button variant="outline" onClick={startEditing}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
        {isEditing && (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={cancelEditing} disabled={saving}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button className="lotus-button" onClick={saveChanges} disabled={saving}>
              <Check className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {/* Client Info + Rep Card Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={(editForm.name as string) || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={(editForm.type as string) || ''}
                    onValueChange={(val) => setEditForm({ ...editForm, type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHOOL">School</SelectItem>
                      <SelectItem value="GOVERNMENT">Government</SelectItem>
                      <SelectItem value="HEALTHCARE">Healthcare</SelectItem>
                      <SelectItem value="NONPROFIT">Nonprofit</SelectItem>
                      <SelectItem value="CORPORATE">Corporate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={(editForm.contactName as string) || ''}
                    onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={(editForm.contactEmail as string) || ''}
                    onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={(editForm.contactPhone as string) || ''}
                    onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Spending Limit</Label>
                  <Input
                    type="number"
                    value={editForm.spendingLimit != null ? String(editForm.spendingLimit) : ''}
                    onChange={(e) => setEditForm({ ...editForm, spendingLimit: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={(editForm.address as string) || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={(editForm.city as string) || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={(editForm.state as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP</Label>
                    <Input
                      value={(editForm.zip as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  {client.contactName && (
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Contact</p>
                        <p className="text-sm font-medium">{client.contactName}</p>
                      </div>
                    </div>
                  )}
                  {client.contactEmail && (
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{client.contactEmail}</p>
                      </div>
                    </div>
                  )}
                  {client.contactPhone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">{client.contactPhone}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {(client.address || client.city) && (
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p className="text-sm font-medium">
                          {[client.address, client.city, client.state, client.zip].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {client.fiscalYearStart && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Fiscal Year Start</p>
                        <p className="text-sm font-medium">{formatDate(client.fiscalYearStart)}</p>
                      </div>
                    </div>
                  )}
                  {client.spendingLimit != null && (
                    <div className="flex items-center space-x-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Spending Limit</p>
                        <p className="text-sm font-medium">{formatCurrency(client.spendingLimit)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Rep Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assigned Representative</CardTitle>
          </CardHeader>
          <CardContent>
            {client.assignedRep ? (
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
                  {getInitials(client.assignedRep.name)}
                </div>
                <div>
                  <p className="font-medium">{client.assignedRep.name}</p>
                  <p className="text-sm text-muted-foreground">{client.assignedRep.email}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No rep assigned</p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{client.requests.length}</p>
                <p className="text-xs text-muted-foreground">Requests</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{client.quotes.length}</p>
                <p className="text-xs text-muted-foreground">Quotes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{client.purchaseOrders.length}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-6 overflow-x-auto" aria-label="Client sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 pb-3 pt-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <Card>
        <CardContent className="p-6">
          {/* Requests Tab */}
          {activeTab === 'requests' && (
            client.requests.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-8 w-8 text-muted-foreground" />}
                title="No requests yet"
                description="This client has no procurement requests."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.requests.map((req) => (
                    <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/requests/${req.id}`} className="font-medium hover:underline">
                          {req.subject}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={req.priority === 'URGENT' ? 'destructive' : 'secondary'}>
                          {req.priority}
                        </Badge>
                      </TableCell>
                      <TableCell><StatusPill status={req.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(req.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {/* Quotes Tab */}
          {activeTab === 'quotes' && (
            client.quotes.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
                title="No quotes yet"
                description="No quotes have been created for this client."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.quotes.map((quote) => (
                    <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/quotes/${quote.id}`} className="font-medium font-mono hover:underline">
                          {quote.quoteNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(quote.totalAmount)}</TableCell>
                      <TableCell><StatusPill status={quote.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(quote.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {/* Purchase Orders Tab */}
          {activeTab === 'orders' && (
            client.purchaseOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="h-8 w-8 text-muted-foreground" />}
                title="No purchase orders yet"
                description="No purchase orders have been created for this client."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.purchaseOrders.map((po) => (
                    <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/orders/${po.id}`} className="font-medium font-mono hover:underline">
                          {po.poNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(po.totalAmount)}</TableCell>
                      <TableCell><StatusPill status={po.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(po.receivedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            !client.activityLogs || client.activityLogs.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-8 w-8 text-muted-foreground" />}
                title="No activity yet"
                description="No activity has been recorded for this client."
              />
            ) : (
              <div className="space-y-4">
                {client.activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-3 py-3 border-b last:border-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {getInitials(log.user.name || 'U')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{log.user.name}</span>{' '}
                        <span className="text-muted-foreground">{log.action}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Add Note Form */}
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a note about this client..."
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

              {/* Notes List */}
              {!client.notes || client.notes.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="h-8 w-8 text-muted-foreground" />}
                  title="No notes yet"
                  description="Add a note to keep track of important client details."
                />
              ) : (
                <div className="space-y-4">
                  {client.notes.map((note) => (
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
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
