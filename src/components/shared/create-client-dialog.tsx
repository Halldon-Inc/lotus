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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClientSchema } from '@/lib/validations'
import type { CreateClientInput } from '@/lib/validations'

interface CreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const CLIENT_TYPES = [
  { value: 'SCHOOL', label: 'School' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'NONPROFIT', label: 'Nonprofit' },
  { value: 'CORPORATE', label: 'Corporate' },
] as const

export function CreateClientDialog({ open, onOpenChange, onSuccess }: CreateClientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: '',
      type: 'SCHOOL',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      fiscalYearStart: '',
      spendingLimit: undefined,
    },
  })

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

  const onSubmit = async (data: CreateClientInput) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/v1/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to create client (${response.status})`)
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Client</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add a new client organization to the system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Client created successfully.
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Organization name and type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="client-name"
                placeholder="e.g. Lincoln High School"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-type">
                Type <span className="text-red-500">*</span>
              </Label>
              <Select
                defaultValue="SCHOOL"
                onValueChange={(val) => setValue('type', val as CreateClientInput['type'])}
              >
                <SelectTrigger id="client-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-xs text-red-500">{errors.type.message}</p>
              )}
            </div>
          </div>

          {/* Contact information */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Contact Name</Label>
                <Input
                  id="contact-name"
                  placeholder="Jane Smith"
                  {...register('contactName')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="jane@school.edu"
                  {...register('contactEmail')}
                />
                {errors.contactEmail && (
                  <p className="text-xs text-red-500">{errors.contactEmail.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Contact Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="(555) 123-4567"
                {...register('contactPhone')}
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Address</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main Street"
                  {...register('address')}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2 col-span-2 sm:col-span-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="Springfield" {...register('city')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" placeholder="IL" {...register('state')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input id="zip" placeholder="62701" {...register('zip')} />
                </div>
              </div>
            </div>
          </div>

          {/* Fiscal / Spending */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiscal-year-start">Fiscal Year Start</Label>
              <Input
                id="fiscal-year-start"
                type="date"
                {...register('fiscalYearStart')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spending-limit">Spending Limit ($)</Label>
              <Input
                id="spending-limit"
                type="number"
                step="0.01"
                min="0"
                placeholder="50000"
                {...register('spendingLimit', { valueAsNumber: true })}
              />
              {errors.spendingLimit && (
                <p className="text-xs text-red-500">{errors.spendingLimit.message}</p>
              )}
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
              {success ? 'Created' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
