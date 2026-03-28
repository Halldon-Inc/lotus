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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createApprovalRuleSchema } from '@/lib/validations'
import type { CreateApprovalRuleInput } from '@/lib/validations'

interface ApprovalConfigProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const ENTITY_TYPES = [
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'REQUEST', label: 'Request' },
] as const

const CONDITION_FIELDS = [
  { value: 'totalAmount', label: 'Total Amount' },
  { value: 'priority', label: 'Priority' },
] as const

const CONDITION_OPS = [
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'lt', label: 'Less than (<)' },
  { value: 'gte', label: 'Greater or equal (>=)' },
  { value: 'lte', label: 'Less or equal (<=)' },
  { value: 'eq', label: 'Equal to (=)' },
] as const

const APPROVER_ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'PROCUREMENT', label: 'Procurement' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'SALES', label: 'Sales' },
] as const

export function ApprovalConfig({ open, onOpenChange, onSuccess }: ApprovalConfigProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateApprovalRuleInput>({
    resolver: zodResolver(createApprovalRuleSchema),
    defaultValues: {
      name: '',
      entityType: 'PURCHASE_ORDER',
      conditionField: 'totalAmount',
      conditionOp: 'gt',
      conditionValue: '',
      approverRole: '',
      priority: 0,
      isActive: true,
    },
  })

  const isActive = watch('isActive')

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

  const onSubmit = async (data: CreateApprovalRuleInput) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/v1/approvals/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `Failed to create rule (${response.status})`)
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Approval Rule</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Define conditions that require approval before proceeding.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Approval rule created successfully.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Rule Name */}
          <div className="space-y-2">
            <Label htmlFor="rule-name">
              Rule Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="rule-name"
              placeholder="e.g. High-value PO approval"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Entity Type */}
          <div className="space-y-2">
            <Label>
              Entity Type <span className="text-red-500">*</span>
            </Label>
            <Select
              defaultValue="PURCHASE_ORDER"
              onValueChange={(val) => setValue('entityType', val as CreateApprovalRuleInput['entityType'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition Row */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Condition</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Field</Label>
                <Select
                  defaultValue="totalAmount"
                  onValueChange={(val) => setValue('conditionField', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Operator</Label>
                <Select
                  defaultValue="gt"
                  onValueChange={(val) => setValue('conditionOp', val as CreateApprovalRuleInput['conditionOp'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  placeholder="e.g. 5000"
                  {...register('conditionValue')}
                />
                {errors.conditionValue && (
                  <p className="text-xs text-red-500">{errors.conditionValue.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Approver Role */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Approver Role</Label>
              <Select
                onValueChange={(val) => setValue('approverRole', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVER_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (order)</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                placeholder="0"
                {...register('priority', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">
                Enable this rule to start requiring approvals
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue('isActive', checked)}
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
            <Button type="submit" disabled={isSubmitting || success}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {success ? 'Created' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
