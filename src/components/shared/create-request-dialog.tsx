'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2, Search } from 'lucide-react'
import type { Client, ApiResponse, PaginatedResponse } from '@/types'
import { debounce } from '@/lib/utils'

const requestFormSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  source: z.enum(['EMAIL', 'MANUAL', 'HUBSPOT']),
})

type RequestFormData = z.infer<typeof requestFormSchema>

interface CreateRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const

const SOURCES = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'HUBSPOT', label: 'HubSpot' },
] as const

export function CreateRequestDialog({ open, onOpenChange, onSuccess }: CreateRequestDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Client search state
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientsLoading, setClientsLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      clientId: '',
      subject: '',
      description: '',
      priority: 'MEDIUM',
      source: 'MANUAL',
    },
  })

  const fetchClients = useCallback(async (query: string) => {
    setClientsLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '20' })
      if (query) params.set('query', query)
      const response = await fetch(`/api/v1/clients?${params.toString()}`)
      if (response.ok) {
        const body: PaginatedResponse<Client> = await response.json()
        setClients(body.data?.items || [])
      }
    } catch {
      // Silently handle fetch errors for search
    } finally {
      setClientsLoading(false)
    }
  }, [])

  const debouncedSearch = useCallback(
    debounce((query: string) => fetchClients(query), 300),
    [fetchClients]
  )

  useEffect(() => {
    if (open) {
      fetchClients('')
    }
  }, [open, fetchClients])

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value)
    setShowClientDropdown(true)
    debouncedSearch(value)
  }

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client)
    setClientSearch(client.name)
    setValue('clientId', client.id)
    setShowClientDropdown(false)
  }

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) {
      if (!isOpen) {
        reset()
        setError(null)
        setSuccess(false)
        setSelectedClient(null)
        setClientSearch('')
      }
      onOpenChange(isOpen)
    }
  }

  const onSubmit = async (data: RequestFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to create request (${response.status})`)
      }

      setSuccess(true)
      setTimeout(() => {
        reset()
        setSuccess(false)
        setSelectedClient(null)
        setClientSearch('')
        onOpenChange(false)
        onSuccess()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Request</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Create a procurement request for a client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Request created successfully.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Client search */}
          <div className="space-y-2 relative">
            <Label htmlFor="client-search">
              Client <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="client-search"
                placeholder="Search clients..."
                value={clientSearch}
                onChange={(e) => handleClientSearchChange(e.target.value)}
                onFocus={() => setShowClientDropdown(true)}
                className="pl-10"
              />
            </div>
            {errors.clientId && (
              <p className="text-xs text-red-500">{errors.clientId.message}</p>
            )}
            {selectedClient && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedClient.name} ({selectedClient.type})
              </p>
            )}

            {/* Client dropdown */}
            {showClientDropdown && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                {clientsLoading ? (
                  <div className="flex items-center justify-center p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : clients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    No clients found
                  </div>
                ) : (
                  clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex justify-between items-center"
                      onClick={() => handleSelectClient(client)}
                    >
                      <span className="font-medium">{client.name}</span>
                      <span className="text-xs text-muted-foreground">{client.type}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="request-subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="request-subject"
              placeholder="Brief summary of the request"
              {...register('subject')}
            />
            {errors.subject && (
              <p className="text-xs text-red-500">{errors.subject.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="request-description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="request-description"
              placeholder="Detailed description of items or services needed"
              rows={4}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Priority and Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="request-priority">
                Priority <span className="text-red-500">*</span>
              </Label>
              <Select
                defaultValue="MEDIUM"
                onValueChange={(val) => setValue('priority', val as RequestFormData['priority'])}
              >
                <SelectTrigger id="request-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.priority && (
                <p className="text-xs text-red-500">{errors.priority.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-source">Source</Label>
              <Select
                defaultValue="MANUAL"
                onValueChange={(val) => setValue('source', val as RequestFormData['source'])}
              >
                <SelectTrigger id="request-source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || success}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {success ? 'Created' : 'Create Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
