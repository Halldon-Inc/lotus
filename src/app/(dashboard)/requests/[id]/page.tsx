'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  FileText,
  Building2,
  User,
  Mail,
  Phone,
  Calendar,
  Receipt,
  Clock,
  MessageSquare,
  Plus,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Edit3,
} from 'lucide-react'
import { formatDate, formatRelativeTime, formatCurrency, getInitials } from '@/lib/utils'
import Link from 'next/link'
import type { ApiResponse, NoteWithUser } from '@/types'

interface RequestDetail {
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
    contactName: string | null
    contactEmail: string | null
    contactPhone: string | null
  }
  assignedTo: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  createdBy: {
    id: string
    name: string
    email: string
  }
  quotes: {
    id: string
    quoteNumber: string
    totalAmount: number
    status: string
    createdAt: string
  }[]
  notes: NoteWithUser[]
}

interface TeamMember {
  id: string
  name: string
  email: string
}

const STATUS_STEPS = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'QUOTED', 'CLOSED'] as const

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingAssignee, setUpdatingAssignee] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ subject: '', description: '', priority: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const requestId = params.id as string

  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/requests/${requestId}`)
      const result: ApiResponse<RequestDetail> = await response.json()

      if (result.success && result.data) {
        setRequest(result.data)
      } else {
        setError(result.error || 'Failed to load request')
      }
    } catch (err) {
      setError('Failed to load request')
    } finally {
      setLoading(false)
    }
  }, [requestId])

  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/users?role=SALES&role=MANAGER&role=ADMIN')
      const result: ApiResponse<TeamMember[]> = await response.json()
      if (result.success && result.data) {
        setTeamMembers(result.data)
      }
    } catch (err) {
      // Silent fail for team members
    }
  }, [])

  useEffect(() => {
    fetchRequest()
    fetchTeamMembers()
  }, [fetchRequest, fetchTeamMembers])

  const updateStatus = async (newStatus: string) => {
    try {
      setUpdatingStatus(true)
      const response = await fetch(`/api/v1/requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchRequest()
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const updateAssignee = async (userId: string) => {
    try {
      setUpdatingAssignee(true)
      const response = await fetch(`/api/v1/requests/${requestId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: userId }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchRequest()
      }
    } catch (err) {
      console.error('Failed to update assignee:', err)
    } finally {
      setUpdatingAssignee(false)
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
          entityType: 'REQUEST',
          entityId: requestId,
          content: newNote.trim(),
        }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setNewNote('')
        fetchRequest()
      }
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setAddingNote(false)
    }
  }

  const openEditDialog = () => {
    if (!request) return
    setEditForm({
      subject: request.subject,
      description: request.description,
      priority: request.priority,
    })
    setEditDialogOpen(true)
  }

  const saveEdit = async () => {
    if (!editForm.subject.trim() || !editForm.description.trim()) return
    try {
      setSavingEdit(true)
      const response = await fetch(`/api/v1/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editForm.subject.trim(),
          description: editForm.description.trim(),
          priority: editForm.priority,
        }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setEditDialogOpen(false)
        fetchRequest()
      }
    } catch (err) {
      console.error('Failed to update request:', err)
    } finally {
      setSavingEdit(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'EMAIL': return { icon: '📧', label: 'Email' }
      case 'HUBSPOT': return { icon: '🔗', label: 'HubSpot' }
      default: return { icon: '✋', label: 'Manual' }
    }
  }

  const canManage = session?.user.role && ['ADMIN', 'MANAGER', 'SALES'].includes(session.user.role)

  if (loading) {
    return <LoadingState message="Loading request details..." size="lg" />
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/requests')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Requests
        </Button>
        <EmptyState
          icon={<FileText className="h-8 w-8 text-muted-foreground" />}
          title="Request not found"
          description={error || 'The request you are looking for does not exist.'}
          action={{ label: 'Back to Requests', onClick: () => router.push('/requests') }}
        />
      </div>
    )
  }

  const currentStepIndex = STATUS_STEPS.indexOf(request.status as typeof STATUS_STEPS[number])
  const sourceInfo = getSourceLabel(request.source)

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/requests')} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Requests
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-foreground">{request.subject}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <StatusPill status={request.status} size="lg" />
            <Badge className={getPriorityColor(request.priority)}>{request.priority}</Badge>
            <Badge variant="outline">
              <span className="mr-1">{sourceInfo.icon}</span>
              {sourceInfo.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {formatDate(request.createdAt)} by {request.createdBy.name}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openEditDialog}>
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/quotes?requestId=${request.id}`}>
                <Receipt className="mr-2 h-4 w-4" />
                Create Quote
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex
              const isCurrent = index === currentStepIndex
              const isUpcoming = index > currentStepIndex

              return (
                <div key={step} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => canManage && !updatingStatus && updateStatus(step)}
                      disabled={!canManage || updatingStatus}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isCurrent
                          ? 'border-primary bg-primary text-primary-foreground scale-110'
                          : isCompleted
                          ? 'border-primary bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
                          : 'border-muted-foreground/30 bg-background text-muted-foreground cursor-pointer hover:border-muted-foreground/50'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <span className="text-xs font-bold">{index + 1}</span>
                      )}
                    </button>
                    <span className={`mt-2 text-xs font-medium whitespace-nowrap ${
                      isCurrent ? 'text-primary' : isCompleted ? 'text-primary/70' : 'text-muted-foreground'
                    }`}>
                      {step.replace('_', ' ')}
                    </span>
                  </div>
                  {index < STATUS_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-2 mt-[-1.25rem] ${
                      index < currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/20'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {request.description}
              </p>
            </CardContent>
          </Card>

          {/* Linked Quotes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Linked Quotes</CardTitle>
              {canManage && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/quotes?requestId=${request.id}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Quote
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {request.quotes.length === 0 ? (
                <EmptyState
                  icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
                  title="No quotes linked"
                  description="No quotes have been created for this request yet."
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
                    {request.quotes.map((quote) => (
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
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a note..."
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

              {!request.notes || request.notes.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="h-6 w-6 text-muted-foreground" />}
                  title="No notes"
                  description="Add a note to keep track of important details."
                  className="py-6"
                />
              ) : (
                <div className="space-y-3">
                  {request.notes.map((note) => (
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href={`/clients/${request.client.id}`} className="block hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">{request.client.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{request.client.type.toLowerCase()}</p>
                  </div>
                </div>
              </Link>
              <div className="mt-4 space-y-3 border-t pt-4">
                {request.client.contactName && (
                  <div className="flex items-center space-x-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{request.client.contactName}</span>
                  </div>
                )}
                {request.client.contactEmail && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{request.client.contactEmail}</span>
                  </div>
                )}
                {request.client.contactPhone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{request.client.contactPhone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              {request.assignedTo ? (
                <div className="flex items-center space-x-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    {getInitials(request.assignedTo.name)}
                  </div>
                  <div>
                    <p className="font-medium">{request.assignedTo.name}</p>
                    <p className="text-sm text-muted-foreground">{request.assignedTo.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3 mb-4 text-muted-foreground">
                  <UserPlus className="h-5 w-5" />
                  <span className="text-sm">Unassigned</span>
                </div>
              )}

              {canManage && (
                <Select
                  value={request.assignedTo?.id || ''}
                  onValueChange={updateAssignee}
                  disabled={updatingAssignee}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Reassign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Priority</span>
                <Badge className={getPriorityColor(request.priority)}>{request.priority}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Source</span>
                <Badge variant="outline">
                  <span className="mr-1">{sourceInfo.icon}</span>
                  {sourceInfo.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(request.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatRelativeTime(request.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quotes</span>
                <Badge variant="secondary">{request.quotes.length}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Request Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Request</DialogTitle>
            <DialogDescription>
              Update the subject, description, and priority for this request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject</Label>
              <Input
                id="edit-subject"
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                placeholder="Request subject"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Request description"
                rows={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Select
                value={editForm.priority}
                onValueChange={(val) => setEditForm({ ...editForm, priority: val })}
              >
                <SelectTrigger id="edit-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              className="lotus-button"
              onClick={saveEdit}
              disabled={savingEdit || !editForm.subject.trim() || !editForm.description.trim()}
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
