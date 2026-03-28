'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import {
  ArrowLeft,
  Package,
  Lock,
  ShieldCheck,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  SlidersHorizontal,
  Link2,
  History,
} from 'lucide-react'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'

interface InventoryMovement {
  id: string
  type: string
  quantity: number
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdAt: string
  performedBy: {
    id: string
    name: string | null
    email: string
  }
}

interface InventoryItemDetail {
  id: string
  name: string
  sku: string | null
  description: string | null
  category: string | null
  quantityOnHand: number
  quantityReserved: number
  reorderPoint: number
  location: string | null
  unitCost: number | null
  lastRestockedAt: string | null
  createdAt: string
  updatedAt: string
  movements: InventoryMovement[]
  _count: { movements: number }
}

interface PurchaseOrderOption {
  id: string
  poNumber: string
  client: { name: string }
}

const movementTypeConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  RECEIVED: {
    label: 'Received',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <ArrowDownToLine className="h-3 w-3" />,
  },
  SHIPPED: {
    label: 'Shipped',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <ArrowUpFromLine className="h-3 w-3" />,
  },
  ALLOCATED: {
    label: 'Allocated',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Lock className="h-3 w-3" />,
  },
  RETURNED: {
    label: 'Returned',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <RotateCcw className="h-3 w-3" />,
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    className: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: <SlidersHorizontal className="h-3 w-3" />,
  },
}

function MovementTypeBadge({ type }: { type: string }) {
  const config = movementTypeConfig[type] || {
    label: type,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: null,
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

function StockBar({ onHand, reorderPoint }: { onHand: number; reorderPoint: number }) {
  if (reorderPoint <= 0) {
    return (
      <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
      </div>
    )
  }

  // Calculate percentage: 100% = 2x reorder point (comfortable stock)
  const maxDisplay = reorderPoint * 2
  const percentage = Math.min((onHand / maxDisplay) * 100, 100)

  let barColor = 'bg-emerald-500'
  if (onHand <= 0) barColor = 'bg-red-500'
  else if (onHand <= reorderPoint) barColor = 'bg-amber-500'

  return (
    <div className="space-y-1">
      <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden relative">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${percentage}%` }}
        />
        {/* Reorder point marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
          style={{ left: `${(reorderPoint / maxDisplay) * 100}%` }}
          title={`Reorder point: ${reorderPoint}`}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-0.5 bg-gray-400" />
          Reorder: {reorderPoint}
        </span>
        <span>{maxDisplay}+</span>
      </div>
    </div>
  )
}

export default function InventoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()

  const [item, setItem] = useState<InventoryItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [adjustForm, setAdjustForm] = useState({
    type: 'RECEIVED' as 'RECEIVED' | 'SHIPPED' | 'RETURNED' | 'ADJUSTMENT',
    quantity: 0,
    notes: '',
  })

  const [allocateForm, setAllocateForm] = useState({
    purchaseOrderId: '',
    quantity: 0,
  })
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([])

  const itemId = typeof params.id === 'string' ? params.id : ''

  const fetchItem = useCallback(async () => {
    if (!itemId) return
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/inventory/${itemId}`)
      const result = await response.json()
      if (result.success && result.data) {
        setItem(result.data)
      } else {
        setError(result.error || 'Failed to load item')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch('/api/v1/orders?pageSize=50&sortBy=createdAt&sortDirection=desc')
      const data = await res.json()
      if (data.success && data.data?.items) {
        setPurchaseOrders(
          data.data.items.map((po: { id: string; poNumber: string; client: { name: string } }) => ({
            id: po.id,
            poNumber: po.poNumber,
            client: po.client,
          }))
        )
      }
    } catch {
      // Non-critical
    }
  }

  const handleAdjustStock = async () => {
    if (!item) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/v1/inventory/${item.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustForm),
      })
      const result = await response.json()
      if (result.success) {
        setAdjustDialogOpen(false)
        setAdjustForm({ type: 'RECEIVED', quantity: 0, notes: '' })
        fetchItem()
      } else {
        setError(result.error || 'Failed to adjust stock')
      }
    } catch {
      setError('Failed to adjust stock')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAllocateStock = async () => {
    if (!item) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/v1/inventory/${item.id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocateForm),
      })
      const result = await response.json()
      if (result.success) {
        setAllocateDialogOpen(false)
        setAllocateForm({ purchaseOrderId: '', quantity: 0 })
        fetchItem()
      } else {
        setError(result.error || 'Failed to allocate stock')
      }
    } catch {
      setError('Failed to allocate stock')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState message="Loading inventory item..." size="lg" />
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/inventory')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inventory
        </Button>
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mb-3" />
          <h3 className="text-lg font-medium text-foreground">
            {error || 'Item not found'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Could not load this inventory item.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/inventory')}
          >
            Return to Inventory
          </Button>
        </div>
      </div>
    )
  }

  const available = item.quantityOnHand - item.quantityReserved
  const stockLevel =
    item.reorderPoint <= 0
      ? 'normal'
      : item.quantityOnHand <= 0
        ? 'critical'
        : item.quantityOnHand <= item.reorderPoint
          ? 'low'
          : 'normal'

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push('/inventory')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Inventory
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-foreground">{item.name}</h1>
              {item.sku && (
                <Badge variant="secondary" className="font-mono">
                  {item.sku}
                </Badge>
              )}
              {item.category && (
                <Badge variant="outline">
                  {item.category}
                </Badge>
              )}
            </div>
            {item.location && (
              <p className="text-muted-foreground mt-1">
                Location: {item.location}
              </p>
            )}
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {item.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setAdjustForm({ type: 'RECEIVED', quantity: 0, notes: '' })
              setAdjustDialogOpen(true)
            }}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Receive Stock
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setAdjustForm({ type: 'ADJUSTMENT', quantity: 0, notes: '' })
              setAdjustDialogOpen(true)
            }}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Adjust
          </Button>
          <Button
            onClick={() => {
              setAllocateForm({ purchaseOrderId: '', quantity: 0 })
              fetchPurchaseOrders()
              setAllocateDialogOpen(true)
            }}
          >
            <Lock className="mr-2 h-4 w-4" />
            Allocate to PO
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-red-700"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Stock Level Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                stockLevel === 'critical'
                  ? 'bg-red-50 text-red-600'
                  : stockLevel === 'low'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
              )}>
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">On Hand</p>
                <p className={cn(
                  'text-2xl font-bold tabular-nums',
                  stockLevel === 'critical' && 'text-red-600',
                  stockLevel === 'low' && 'text-amber-600'
                )}>
                  {item.quantityOnHand}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Reserved</p>
                <p className="text-2xl font-bold tabular-nums">{item.quantityReserved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                available <= 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              )}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Available</p>
                <p className={cn(
                  'text-2xl font-bold tabular-nums',
                  available <= 0 && 'text-red-600'
                )}>
                  {available}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Reorder Point</p>
                <p className="text-2xl font-bold tabular-nums">{item.reorderPoint}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Level Bar */}
      {item.reorderPoint > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Level</CardTitle>
          </CardHeader>
          <CardContent>
            <StockBar onHand={item.quantityOnHand} reorderPoint={item.reorderPoint} />
          </CardContent>
        </Card>
      )}

      {/* Item Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Item Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Unit Cost</dt>
                <dd className="text-sm font-medium">
                  {item.unitCost != null ? formatCurrency(item.unitCost) : 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Total Value</dt>
                <dd className="text-sm font-medium">
                  {item.unitCost != null
                    ? formatCurrency(item.quantityOnHand * item.unitCost)
                    : 'N/A'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Location</dt>
                <dd className="text-sm font-medium">{item.location || 'Not set'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Last Restocked</dt>
                <dd className="text-sm font-medium">
                  {item.lastRestockedAt ? formatDateTime(item.lastRestockedAt) : 'Never'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Total Movements</dt>
                <dd className="text-sm font-medium">{item._count.movements}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stockLevel === 'critical' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-sm text-red-700">
                    Stock is at zero. Immediate restocking needed.
                  </p>
                </div>
              )}
              {stockLevel === 'low' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700">
                    Stock is at or below the reorder point ({item.reorderPoint}).
                    Consider restocking soon.
                  </p>
                </div>
              )}
              {stockLevel === 'normal' && item.reorderPoint > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-700">
                    Stock levels are healthy. {item.quantityOnHand - item.reorderPoint} units above reorder point.
                  </p>
                </div>
              )}
              {item.quantityReserved > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <Lock className="h-4 w-4 text-purple-600 shrink-0" />
                  <p className="text-sm text-purple-700">
                    {item.quantityReserved} units reserved for purchase orders.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Movement History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Movement History (Last 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {item.movements.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8 text-muted-foreground" />}
              title="No movements yet"
              description="Stock movements will appear here as you receive, ship, or adjust inventory."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.movements.map((movement) => {
                    const isPositive = ['RECEIVED', 'RETURNED'].includes(movement.type)
                    const isNegative = ['SHIPPED', 'ALLOCATED'].includes(movement.type)
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDateTime(movement.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <MovementTypeBadge type={movement.type} />
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'font-medium tabular-nums',
                              isPositive && 'text-emerald-600',
                              isNegative && 'text-red-600'
                            )}
                          >
                            {isPositive ? '+' : isNegative ? '-' : ''}
                            {Math.abs(movement.quantity)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {movement.referenceType && movement.referenceId ? (
                            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                              <Link2 className="h-3 w-3" />
                              {movement.referenceType === 'PURCHASE_ORDER' ? 'PO' : movement.referenceType}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Manual</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {movement.performedBy.name || movement.performedBy.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                            {movement.notes || '\u2014'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Adjusting stock for <strong>{item.name}</strong>.
              Current on hand: {item.quantityOnHand}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Adjustment Type</Label>
              <Select
                value={adjustForm.type}
                onValueChange={(value) =>
                  setAdjustForm({ ...adjustForm, type: value as typeof adjustForm.type })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIVED">Received (add stock)</SelectItem>
                  <SelectItem value="SHIPPED">Shipped (remove stock)</SelectItem>
                  <SelectItem value="RETURNED">Returned (add stock)</SelectItem>
                  <SelectItem value="ADJUSTMENT">Set to exact amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-adjust-qty">
                {adjustForm.type === 'ADJUSTMENT' ? 'New Quantity' : 'Quantity'}
              </Label>
              <Input
                id="detail-adjust-qty"
                type="number"
                min={adjustForm.type === 'ADJUSTMENT' ? 0 : 1}
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-adjust-notes">Notes</Label>
              <Textarea
                id="detail-adjust-notes"
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                placeholder="Reason for adjustment"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustStock}
              disabled={adjustForm.quantity <= 0 || submitting}
            >
              {submitting ? 'Adjusting...' : 'Confirm Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate to PO Dialog */}
      <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate to Purchase Order</DialogTitle>
            <DialogDescription>
              Allocating <strong>{item.name}</strong>.
              Available: {available} units
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Purchase Order</Label>
              <Select
                value={allocateForm.purchaseOrderId}
                onValueChange={(value) =>
                  setAllocateForm({ ...allocateForm, purchaseOrderId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a PO" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.poNumber} | {po.client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="detail-allocate-qty">Quantity</Label>
              <Input
                id="detail-allocate-qty"
                type="number"
                min={1}
                max={available}
                value={allocateForm.quantity}
                onChange={(e) => setAllocateForm({ ...allocateForm, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAllocateStock}
              disabled={!allocateForm.purchaseOrderId || allocateForm.quantity <= 0 || submitting}
            >
              {submitting ? 'Allocating...' : 'Allocate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
