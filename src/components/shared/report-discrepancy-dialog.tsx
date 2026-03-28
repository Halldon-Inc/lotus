'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2, Plus, Trash2, Camera } from 'lucide-react'
import { createDiscrepancySchema } from '@/lib/validations'
import type { CreateDiscrepancyInput } from '@/lib/validations'

interface ReportDiscrepancyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  purchaseOrderId?: string
  purchaseOrderItemId?: string
  invoiceId?: string
}

const DISCREPANCY_TYPES = [
  { value: 'QUANTITY_MISMATCH', label: 'Quantity Mismatch', icon: '📊' },
  { value: 'PRICE_MISMATCH', label: 'Price Mismatch', icon: '💰' },
  { value: 'WRONG_ITEM', label: 'Wrong Item', icon: '🔄' },
  { value: 'DAMAGED', label: 'Damaged', icon: '💥' },
  { value: 'MISSING', label: 'Missing', icon: '❓' },
  { value: 'EXTRA', label: 'Extra Items', icon: '➕' },
] as const

export function ReportDiscrepancyDialog({
  open,
  onOpenChange,
  onSuccess,
  purchaseOrderId,
  purchaseOrderItemId,
  invoiceId,
}: ReportDiscrepancyDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<string[]>([''])

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateDiscrepancyInput>({
    resolver: zodResolver(createDiscrepancySchema),
    defaultValues: {
      purchaseOrderId: purchaseOrderId || '',
      purchaseOrderItemId: purchaseOrderItemId || '',
      invoiceId: invoiceId || '',
      type: 'QUANTITY_MISMATCH',
      expectedValue: '',
      actualValue: '',
      photoUrls: [],
    },
  })

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) {
      if (!isOpen) {
        reset()
        setError(null)
        setSuccess(false)
        setPhotoUrls([''])
      }
      onOpenChange(isOpen)
    }
  }

  const addPhotoUrl = () => {
    if (photoUrls.length < 3) {
      setPhotoUrls([...photoUrls, ''])
    }
  }

  const removePhotoUrl = (index: number) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index))
  }

  const updatePhotoUrl = (index: number, value: string) => {
    const updated = [...photoUrls]
    updated[index] = value
    setPhotoUrls(updated)
  }

  const onSubmit = async (data: CreateDiscrepancyInput) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    const validPhotos = photoUrls.filter((url) => url.trim().length > 0)

    try {
      const response = await fetch('/api/v1/discrepancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          photoUrls: validPhotos.length > 0 ? validPhotos : undefined,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to report discrepancy (${response.status})`)
      }

      setSuccess(true)
      setTimeout(() => {
        reset()
        setSuccess(false)
        setPhotoUrls([''])
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Report Discrepancy</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Report an issue with a received item, shipment, or invoice.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Discrepancy reported successfully.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Discrepancy Type */}
          <div className="space-y-2">
            <Label>
              Type <span className="text-red-500">*</span>
            </Label>
            <Select
              defaultValue="QUANTITY_MISMATCH"
              onValueChange={(val) => setValue('type', val as CreateDiscrepancyInput['type'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select discrepancy type" />
              </SelectTrigger>
              <SelectContent>
                {DISCREPANCY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center space-x-2">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PO + Item + Invoice IDs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="po-id">
                Purchase Order ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="po-id"
                placeholder="PO ID"
                {...register('purchaseOrderId')}
                defaultValue={purchaseOrderId || ''}
              />
              {purchaseOrderId && (
                <p className="text-xs text-muted-foreground">Pre-filled from PO</p>
              )}
              {errors.purchaseOrderId && (
                <p className="text-xs text-red-500">{errors.purchaseOrderId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-id">Item ID (optional)</Label>
              <Input
                id="item-id"
                placeholder="Specific item ID"
                {...register('purchaseOrderItemId')}
                defaultValue={purchaseOrderItemId || ''}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-id">Invoice ID (optional)</Label>
            <Input
              id="invoice-id"
              placeholder="Related invoice ID"
              {...register('invoiceId')}
              defaultValue={invoiceId || ''}
            />
          </div>

          {/* Expected vs Actual */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expected">
                Expected Value <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expected"
                placeholder="e.g. 100 units or $500.00"
                {...register('expectedValue')}
              />
              {errors.expectedValue && (
                <p className="text-xs text-red-500">{errors.expectedValue.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual">
                Actual Value <span className="text-red-500">*</span>
              </Label>
              <Input
                id="actual"
                placeholder="e.g. 85 units or $475.00"
                {...register('actualValue')}
              />
              {errors.actualValue && (
                <p className="text-xs text-red-500">{errors.actualValue.message}</p>
              )}
            </div>
          </div>

          {/* Photo URLs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center space-x-2">
                <Camera className="h-4 w-4" />
                <span>Photos (optional, up to 3)</span>
              </Label>
              {photoUrls.length < 3 && (
                <Button type="button" variant="outline" size="sm" onClick={addPhotoUrl}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              )}
            </div>
            {photoUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Photo URL"
                  value={url}
                  onChange={(e) => updatePhotoUrl(index, e.target.value)}
                />
                {photoUrls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 h-9 w-9 p-0 shrink-0"
                    onClick={() => removePhotoUrl(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
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
            <Button type="submit" disabled={isSubmitting || success} className="bg-red-600 hover:bg-red-700 text-white">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {success ? 'Reported' : 'Report Discrepancy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
