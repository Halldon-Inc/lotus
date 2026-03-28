'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Loader2, AlertCircle, CheckCircle2, Plus, Trash2, DollarSign } from 'lucide-react'
import { createInvoiceSchema } from '@/lib/validations'
import type { CreateInvoiceInput } from '@/lib/validations'
import { formatCurrency } from '@/lib/utils'

interface CreateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  purchaseOrderId?: string
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  purchaseOrderId,
}: CreateInvoiceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      invoiceNumber: '',
      vendorName: '',
      totalAmount: 0,
      dueDate: '',
      notes: '',
      fileUrl: '',
      purchaseOrderId: purchaseOrderId || '',
      lineItems: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  })

  const watchLineItems = watch('lineItems')
  const calculatedTotal = watchLineItems?.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + qty * price
  }, 0) || 0

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) {
      if (!isOpen) {
        reset()
        setError(null)
        setSuccess(false)
      }
      onOpenChange(isOpen)
    }
  }

  const onSubmit = async (data: CreateInvoiceInput) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    // Auto-calc totalPrice for each line item
    const payload = {
      ...data,
      lineItems: data.lineItems.map((item) => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice,
      })),
    }

    try {
      const response = await fetch('/api/v1/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to create invoice (${response.status})`)
      }

      setSuccess(true)
      setTimeout(() => {
        reset()
        setSuccess(false)
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Invoice</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Record a vendor invoice for matching against purchase orders.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Invoice created successfully.
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Invoice Number + Vendor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-number">
                Invoice Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="invoice-number"
                placeholder="e.g. INV-2026-001"
                {...register('invoiceNumber')}
              />
              {errors.invoiceNumber && (
                <p className="text-xs text-red-500">{errors.invoiceNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-name">
                Vendor Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vendor-name"
                placeholder="e.g. Staples Business Supply"
                {...register('vendorName')}
              />
              {errors.vendorName && (
                <p className="text-xs text-red-500">{errors.vendorName.message}</p>
              )}
            </div>
          </div>

          {/* Total + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total-amount">
                Total Amount ($) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="total-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('totalAmount', { valueAsNumber: true })}
              />
              {errors.totalAmount && (
                <p className="text-xs text-red-500">{errors.totalAmount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                {...register('dueDate')}
              />
            </div>
          </div>

          {/* PO Link + File URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-id">Purchase Order ID (optional)</Label>
              <Input
                id="po-id"
                placeholder="Paste PO ID or leave empty"
                {...register('purchaseOrderId')}
                defaultValue={purchaseOrderId || ''}
              />
              {purchaseOrderId && (
                <p className="text-xs text-muted-foreground">Pre-filled from purchase order</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-url">File URL (optional)</Label>
              <Input
                id="file-url"
                placeholder="Link to invoice PDF"
                {...register('fileUrl')}
              />
              {errors.fileUrl && (
                <p className="text-xs text-red-500">{errors.fileUrl.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this invoice..."
              rows={2}
              {...register('notes')}
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                Line Items <span className="text-red-500">*</span>
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 })}
              >
                <Plus className="mr-2 h-3 w-3" />
                Add Item
              </Button>
            </div>

            {errors.lineItems && typeof errors.lineItems.message === 'string' && (
              <p className="text-xs text-red-500">{errors.lineItems.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => {
                const qty = Number(watchLineItems?.[index]?.quantity) || 0
                const price = Number(watchLineItems?.[index]?.unitPrice) || 0
                const lineTotal = qty * price

                return (
                  <div key={field.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input
                            placeholder="Item description"
                            {...register(`lineItems.${index}.description`)}
                          />
                          {errors.lineItems?.[index]?.description && (
                            <p className="text-xs text-red-500">
                              {errors.lineItems[index]?.description?.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Price ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 pt-5">
                        <span className="text-sm font-medium whitespace-nowrap">
                          {formatCurrency(lineTotal)}
                        </span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Calculated total */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t">
              <div className="flex items-center space-x-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Line Items Total:</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(calculatedTotal)}</span>
              </div>
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
              {success ? 'Created' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
