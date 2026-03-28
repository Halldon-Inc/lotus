'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { PaginatedResponse } from '@/types'

interface RequestOption {
  id: string
  subject: string
  clientId: string
  clientName: string
}

const lineItemSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  quantity: z.number({ message: 'Required' }).int().positive('Must be > 0'),
  unitPrice: z.number({ message: 'Required' }).positive('Must be > 0'),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  vendorName: z.string().optional(),
})

const quoteFormSchema = z.object({
  requestId: z.string().min(1, 'Request is required'),
  clientId: z.string().min(1, 'Client is required'),
  validUntil: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type QuoteFormData = z.infer<typeof quoteFormSchema>

interface CreateQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  requestId?: string
}

const EMPTY_LINE_ITEM = {
  productName: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  sourceUrl: '',
  vendorName: '',
}

export function CreateQuoteDialog({ open, onOpenChange, onSuccess, requestId }: CreateQuoteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [requests, setRequests] = useState<RequestOption[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [selectedClientName, setSelectedClientName] = useState<string>('')

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      requestId: requestId || '',
      clientId: '',
      validUntil: '',
      lineItems: [{ ...EMPTY_LINE_ITEM }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  })

  const watchedLineItems = watch('lineItems')

  const grandTotal = watchedLineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + qty * price
  }, 0)

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const response = await fetch('/api/v1/requests?pageSize=100&status=NEW,ASSIGNED,IN_PROGRESS')
      if (response.ok) {
        const body: PaginatedResponse = await response.json()
        const items = body.data?.items || []
        setRequests(
          items.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            subject: r.subject as string,
            clientId: (r.clientId || (r.client as Record<string, unknown>)?.id) as string,
            clientName: ((r.client as Record<string, unknown>)?.name || 'Unknown') as string,
          }))
        )
      }
    } catch {
      // Silently handle
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchRequests()
    }
  }, [open, fetchRequests])

  // Pre-fill if requestId is provided
  useEffect(() => {
    if (requestId && requests.length > 0) {
      const match = requests.find((r) => r.id === requestId)
      if (match) {
        setValue('requestId', match.id)
        setValue('clientId', match.clientId)
        setSelectedClientName(match.clientName)
      }
    }
  }, [requestId, requests, setValue])

  const handleRequestChange = (reqId: string) => {
    setValue('requestId', reqId)
    const match = requests.find((r) => r.id === reqId)
    if (match) {
      setValue('clientId', match.clientId)
      setSelectedClientName(match.clientName)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) {
      if (!isOpen) {
        reset({
          requestId: requestId || '',
          clientId: '',
          validUntil: '',
          lineItems: [{ ...EMPTY_LINE_ITEM }],
        })
        setError(null)
        setSuccess(false)
        setSelectedClientName('')
      }
      onOpenChange(isOpen)
    }
  }

  const onSubmit = async (data: QuoteFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/v1/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to create quote (${response.status})`)
      }

      setSuccess(true)
      setTimeout(() => {
        reset({
          requestId: requestId || '',
          clientId: '',
          validUntil: '',
          lineItems: [{ ...EMPTY_LINE_ITEM }],
        })
        setSuccess(false)
        setSelectedClientName('')
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
      <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Quote</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Build a quote with line items for a client request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Quote created successfully.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Request and Valid Until */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote-request">
                Request <span className="text-red-500">*</span>
              </Label>
              {requestId ? (
                <Input
                  value={requests.find((r) => r.id === requestId)?.subject || 'Loading...'}
                  disabled
                  className="bg-muted"
                />
              ) : (
                <Select onValueChange={handleRequestChange}>
                  <SelectTrigger id="quote-request">
                    <SelectValue placeholder={requestsLoading ? 'Loading...' : 'Select request'} />
                  </SelectTrigger>
                  <SelectContent>
                    {requests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.requestId && (
                <p className="text-xs text-red-500">{errors.requestId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid-until">Valid Until</Label>
              <Input
                id="valid-until"
                type="date"
                {...register('validUntil')}
              />
            </div>
          </div>

          {/* Client (auto-populated) */}
          {selectedClientName && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Client:</span>{' '}
              <span className="font-medium">{selectedClientName}</span>
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Line Items</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...EMPTY_LINE_ITEM })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            {errors.lineItems?.root && (
              <p className="text-xs text-red-500">{errors.lineItems.root.message}</p>
            )}

            <div className="space-y-4">
              {fields.map((field, index) => {
                const qty = Number(watchedLineItems[index]?.quantity) || 0
                const price = Number(watchedLineItems[index]?.unitPrice) || 0
                const lineTotal = qty * price

                return (
                  <div
                    key={field.id}
                    className="rounded-lg border bg-card p-4 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Item {index + 1}
                      </span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Product Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="Product name"
                          {...register(`lineItems.${index}.productName`)}
                        />
                        {errors.lineItems?.[index]?.productName && (
                          <p className="text-xs text-red-500">
                            {errors.lineItems[index].productName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Input
                          placeholder="Optional description"
                          {...register(`lineItems.${index}.description`)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Qty <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                        />
                        {errors.lineItems?.[index]?.quantity && (
                          <p className="text-xs text-red-500">
                            {errors.lineItems[index].quantity.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Unit Price <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
                        />
                        {errors.lineItems?.[index]?.unitPrice && (
                          <p className="text-xs text-red-500">
                            {errors.lineItems[index].unitPrice.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Vendor</Label>
                        <Input
                          placeholder="Vendor name"
                          {...register(`lineItems.${index}.vendorName`)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Total</Label>
                        <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Source URL</Label>
                      <Input
                        placeholder="https://vendor.com/product"
                        {...register(`lineItems.${index}.sourceUrl`)}
                      />
                      {errors.lineItems?.[index]?.sourceUrl && (
                        <p className="text-xs text-red-500">
                          {errors.lineItems[index].sourceUrl.message}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grand Total */}
          <div className="flex items-center justify-end rounded-lg border bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground mr-3">Grand Total:</span>
            <span className="text-xl font-bold text-foreground">
              {formatCurrency(grandTotal)}
            </span>
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
              {success ? 'Created' : 'Create Quote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
