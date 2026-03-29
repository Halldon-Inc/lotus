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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  FileText,
  ClipboardList,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { PaginatedResponse } from '@/types'

// ----------------------------------------------------------------
// Types for fetched data
// ----------------------------------------------------------------

interface AcceptedQuote {
  id: string
  quoteNumber: string
  totalAmount: number
  status: string
  client: {
    id: string
    name: string
  }
  _count: {
    lineItems: number
  }
}

interface ClientOption {
  id: string
  name: string
  type: string
}

// ----------------------------------------------------------------
// Zod schemas (client-side)
// ----------------------------------------------------------------

const fromQuoteSchema = z.object({
  quoteId: z.string().min(1, 'Please select a quote'),
  poNumber: z.string().min(1, 'PO number is required').max(100, 'PO number too long'),
  scheduledDeliveryDate: z.string().optional(),
  deliveryMethod: z.string().optional(),
})

type FromQuoteFormData = z.infer<typeof fromQuoteSchema>

const manualLineItemSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  quantity: z.number({ message: 'Required' }).int().positive('Must be > 0'),
  unitPrice: z.number({ message: 'Required' }).positive('Must be > 0'),
  vendorName: z.string().optional(),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
})

const manualEntrySchema = z.object({
  clientId: z.string().min(1, 'Please select a client'),
  poNumber: z.string().min(1, 'PO number is required').max(100, 'PO number too long'),
  items: z.array(manualLineItemSchema).min(1, 'At least one line item is required'),
  scheduledDeliveryDate: z.string().optional(),
  deliveryMethod: z.string().optional(),
  procurementMethod: z.string().optional(),
  notes: z.string().optional(),
})

type ManualEntryFormData = z.infer<typeof manualEntrySchema>

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface CreatePoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const EMPTY_LINE_ITEM = {
  productName: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  vendorName: '',
  sourceUrl: '',
}

const DELIVERY_METHODS = [
  { value: 'CARRIER', label: 'Carrier' },
  { value: 'MANUAL', label: 'Manual / Self Pickup' },
] as const

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export function CreatePoDialog({ open, onOpenChange, onSuccess }: CreatePoDialogProps) {
  const [activeTab, setActiveTab] = useState<string>('from-quote')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Data fetching state
  const [quotes, setQuotes] = useState<AcceptedQuote[]>([])
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)

  // Selected quote preview
  const [selectedQuote, setSelectedQuote] = useState<AcceptedQuote | null>(null)

  // ---------------------------
  // From Quote form
  // ---------------------------
  const quoteForm = useForm<FromQuoteFormData>({
    resolver: zodResolver(fromQuoteSchema),
    defaultValues: {
      quoteId: '',
      poNumber: '',
      scheduledDeliveryDate: '',
      deliveryMethod: '',
    },
  })

  // ---------------------------
  // Manual Entry form
  // ---------------------------
  const manualForm = useForm<ManualEntryFormData>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      clientId: '',
      poNumber: '',
      items: [{ ...EMPTY_LINE_ITEM }],
      scheduledDeliveryDate: '',
      deliveryMethod: '',
      procurementMethod: '',
      notes: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: manualForm.control,
    name: 'items',
  })

  const watchedItems = manualForm.watch('items')

  const grandTotal = watchedItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + qty * price
  }, 0)

  // ---------------------------
  // Data fetching
  // ---------------------------

  const fetchQuotes = useCallback(async () => {
    setQuotesLoading(true)
    try {
      const response = await fetch('/api/v1/quotes?status=ACCEPTED&pageSize=100')
      if (response.ok) {
        const body: PaginatedResponse = await response.json()
        const items = body.data?.items || []
        // Filter out quotes that already have a PO attached
        setQuotes(
          items.filter(
            (q: Record<string, unknown>) => !(q as Record<string, unknown>).purchaseOrder
          ) as AcceptedQuote[]
        )
      }
    } catch {
      // Silently handle
    } finally {
      setQuotesLoading(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    setClientsLoading(true)
    try {
      const response = await fetch('/api/v1/clients?pageSize=200')
      if (response.ok) {
        const body: PaginatedResponse = await response.json()
        const items = body.data?.items || []
        setClients(
          items.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            name: c.name as string,
            type: c.type as string,
          }))
        )
      }
    } catch {
      // Silently handle
    } finally {
      setClientsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchQuotes()
      fetchClients()
    }
  }, [open, fetchQuotes, fetchClients])

  // ---------------------------
  // Handlers
  // ---------------------------

  const handleQuoteSelect = (quoteId: string) => {
    quoteForm.setValue('quoteId', quoteId)
    const match = quotes.find((q) => q.id === quoteId)
    setSelectedQuote(match || null)
  }

  const resetAll = () => {
    quoteForm.reset({
      quoteId: '',
      poNumber: '',
      scheduledDeliveryDate: '',
      deliveryMethod: '',
    })
    manualForm.reset({
      clientId: '',
      poNumber: '',
      items: [{ ...EMPTY_LINE_ITEM }],
      scheduledDeliveryDate: '',
      deliveryMethod: '',
      procurementMethod: '',
      notes: '',
    })
    setSelectedQuote(null)
    setError(null)
    setSuccess(false)
  }

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) {
      if (!isOpen) {
        resetAll()
      }
      onOpenChange(isOpen)
    }
  }

  // Submit: From Quote
  const onSubmitFromQuote = async (data: FromQuoteFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const payload: Record<string, unknown> = {
        quoteId: data.quoteId,
        poNumber: data.poNumber,
      }
      if (data.scheduledDeliveryDate) {
        payload.scheduledDeliveryDate = data.scheduledDeliveryDate
      }
      if (data.deliveryMethod) {
        payload.deliveryMethod = data.deliveryMethod
      }

      const response = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to create purchase order (${response.status})`)
      }

      setSuccess(true)
      setTimeout(() => {
        resetAll()
        onOpenChange(false)
        onSuccess()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit: Manual Entry
  const onSubmitManual = async (data: ManualEntryFormData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const calculatedTotal = data.items.reduce((sum, item) => {
        return sum + item.quantity * item.unitPrice
      }, 0)

      const payload: Record<string, unknown> = {
        clientId: data.clientId,
        poNumber: data.poNumber,
        items: data.items,
        totalAmount: calculatedTotal,
      }
      if (data.scheduledDeliveryDate) {
        payload.scheduledDeliveryDate = data.scheduledDeliveryDate
      }
      if (data.deliveryMethod) {
        payload.deliveryMethod = data.deliveryMethod
      }
      if (data.procurementMethod) {
        payload.procurementMethod = data.procurementMethod
      }
      if (data.notes) {
        payload.notes = data.notes
      }

      const response = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to create purchase order (${response.status})`)
      }

      setSuccess(true)
      setTimeout(() => {
        resetAll()
        onOpenChange(false)
        onSuccess()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------
  // Render
  // ---------------------------

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[850px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Purchase Order</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Create a purchase order from an accepted quote or enter details manually.
          </DialogDescription>
        </DialogHeader>

        {/* Status banners */}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Purchase order created successfully.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="from-quote">
              <FileText className="mr-1.5 h-4 w-4" />
              From Quote
            </TabsTrigger>
            <TabsTrigger value="manual">
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          {/* ============================== */}
          {/* Tab 1: From Quote              */}
          {/* ============================== */}
          <TabsContent value="from-quote">
            <form
              onSubmit={quoteForm.handleSubmit(onSubmitFromQuote)}
              className="space-y-5 pt-2"
            >
              {/* Quote selector */}
              <div className="space-y-2">
                <Label htmlFor="po-quote">
                  Accepted Quote <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={handleQuoteSelect}>
                  <SelectTrigger id="po-quote">
                    <SelectValue
                      placeholder={quotesLoading ? 'Loading quotes...' : 'Select an accepted quote'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {quotes.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.quoteNumber} | {q.client.name} | {formatCurrency(q.totalAmount)}
                      </SelectItem>
                    ))}
                    {!quotesLoading && quotes.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No accepted quotes available
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {quoteForm.formState.errors.quoteId && (
                  <p className="text-xs text-red-500">
                    {quoteForm.formState.errors.quoteId.message}
                  </p>
                )}
              </div>

              {/* Quote preview card */}
              {selectedQuote && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{selectedQuote.client.name}</span>
                    <span className="text-sm font-semibold text-[#0D7377]">
                      {formatCurrency(selectedQuote.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Quote {selectedQuote.quoteNumber}</span>
                    <span>{selectedQuote._count.lineItems} line item{selectedQuote._count.lineItems !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}

              {/* PO Number */}
              <div className="space-y-2">
                <Label htmlFor="fq-po-number">
                  PO Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fq-po-number"
                  placeholder="Enter the client's PO number"
                  {...quoteForm.register('poNumber')}
                />
                {quoteForm.formState.errors.poNumber && (
                  <p className="text-xs text-red-500">
                    {quoteForm.formState.errors.poNumber.message}
                  </p>
                )}
              </div>

              {/* Delivery details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fq-delivery-date">Scheduled Delivery Date</Label>
                  <Input
                    id="fq-delivery-date"
                    type="date"
                    {...quoteForm.register('scheduledDeliveryDate')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fq-delivery-method">Delivery Method</Label>
                  <Select
                    onValueChange={(val) => quoteForm.setValue('deliveryMethod', val)}
                  >
                    <SelectTrigger id="fq-delivery-method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
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
                <Button
                  type="submit"
                  disabled={isSubmitting || success}
                  className="bg-[#0D7377] hover:bg-[#0B6163]"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {success ? 'Created' : 'Create Purchase Order'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* ============================== */}
          {/* Tab 2: Manual Entry            */}
          {/* ============================== */}
          <TabsContent value="manual">
            <form
              onSubmit={manualForm.handleSubmit(onSubmitManual)}
              className="space-y-5 pt-2"
            >
              {/* Client and PO Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-client">
                    Client <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    onValueChange={(val) => manualForm.setValue('clientId', val)}
                  >
                    <SelectTrigger id="manual-client">
                      <SelectValue
                        placeholder={clientsLoading ? 'Loading...' : 'Select client'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {manualForm.formState.errors.clientId && (
                    <p className="text-xs text-red-500">
                      {manualForm.formState.errors.clientId.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-po-number">
                    PO Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="manual-po-number"
                    placeholder="Enter the client's PO number"
                    {...manualForm.register('poNumber')}
                  />
                  {manualForm.formState.errors.poNumber && (
                    <p className="text-xs text-red-500">
                      {manualForm.formState.errors.poNumber.message}
                    </p>
                  )}
                </div>
              </div>

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

                {manualForm.formState.errors.items?.root && (
                  <p className="text-xs text-red-500">
                    {manualForm.formState.errors.items.root.message}
                  </p>
                )}

                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const qty = Number(watchedItems[index]?.quantity) || 0
                    const price = Number(watchedItems[index]?.unitPrice) || 0
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
                              {...manualForm.register(`items.${index}.productName`)}
                            />
                            {manualForm.formState.errors.items?.[index]?.productName && (
                              <p className="text-xs text-red-500">
                                {manualForm.formState.errors.items[index].productName.message}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Input
                              placeholder="Optional description"
                              {...manualForm.register(`items.${index}.description`)}
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
                              {...manualForm.register(`items.${index}.quantity`, {
                                valueAsNumber: true,
                              })}
                            />
                            {manualForm.formState.errors.items?.[index]?.quantity && (
                              <p className="text-xs text-red-500">
                                {manualForm.formState.errors.items[index].quantity.message}
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
                              {...manualForm.register(`items.${index}.unitPrice`, {
                                valueAsNumber: true,
                              })}
                            />
                            {manualForm.formState.errors.items?.[index]?.unitPrice && (
                              <p className="text-xs text-red-500">
                                {manualForm.formState.errors.items[index].unitPrice.message}
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Vendor</Label>
                            <Input
                              placeholder="Vendor name"
                              {...manualForm.register(`items.${index}.vendorName`)}
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
                            {...manualForm.register(`items.${index}.sourceUrl`)}
                          />
                          {manualForm.formState.errors.items?.[index]?.sourceUrl && (
                            <p className="text-xs text-red-500">
                              {manualForm.formState.errors.items[index].sourceUrl.message}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex items-center justify-end rounded-lg border bg-[#0D7377]/5 px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground mr-3">Grand Total:</span>
                <span className="text-xl font-bold text-foreground">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              {/* Procurement Method */}
              <div className="space-y-2">
                <Label htmlFor="manual-procurement-method">Procurement Method</Label>
                <Select
                  onValueChange={(val) => manualForm.setValue('procurementMethod', val)}
                >
                  <SelectTrigger id="manual-procurement-method">
                    <SelectValue placeholder="Select procurement method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPETITIVE_BID">Competitive Bid</SelectItem>
                    <SelectItem value="COOPERATIVE_CONTRACT">Cooperative Contract</SelectItem>
                    <SelectItem value="SOLE_SOURCE">Sole Source</SelectItem>
                    <SelectItem value="MICRO_PURCHASE">Micro Purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-delivery-date">Scheduled Delivery Date</Label>
                  <Input
                    id="manual-delivery-date"
                    type="date"
                    {...manualForm.register('scheduledDeliveryDate')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-delivery-method">Delivery Method</Label>
                  <Select
                    onValueChange={(val) => manualForm.setValue('deliveryMethod', val)}
                  >
                    <SelectTrigger id="manual-delivery-method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="manual-notes">Notes</Label>
                <Textarea
                  id="manual-notes"
                  placeholder="Additional notes for this purchase order"
                  rows={3}
                  {...manualForm.register('notes')}
                />
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
                <Button
                  type="submit"
                  disabled={isSubmitting || success}
                  className="bg-[#0D7377] hover:bg-[#0B6163]"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {success ? 'Created' : 'Create Purchase Order'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
