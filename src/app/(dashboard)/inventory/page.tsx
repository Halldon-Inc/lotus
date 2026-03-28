'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
import { StatCard } from '@/components/shared/stat-card'
import {
  Search,
  Warehouse,
  DollarSign,
  AlertTriangle,
  Lock,
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Package,
} from 'lucide-react'
import { formatCurrency, debounce, cn } from '@/lib/utils'

interface InventoryItem {
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
  _count: { movements: number }
}

interface InventoryResponse {
  success: boolean
  data?: {
    items: InventoryItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  error?: string
}

interface LowStockResponse {
  success: boolean
  data?: { count: number; items: InventoryItem[] }
  error?: string
}

interface PurchaseOrderOption {
  id: string
  poNumber: string
  client: { name: string }
}

type SortField = 'name' | 'sku' | 'category' | 'quantityOnHand' | 'unitCost'

export default function InventoryPage() {
  const router = useRouter()
  const { data: session } = useSession()

  // Data state
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // KPI state
  const [totalItems, setTotalItems] = useState(0)
  const [totalValue, setTotalValue] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [reservedCount, setReservedCount] = useState(0)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Add form
  const [addForm, setAddForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    quantityOnHand: 0,
    reorderPoint: 0,
    location: '',
    unitCost: 0,
  })

  // Adjust form
  const [adjustForm, setAdjustForm] = useState({
    type: 'RECEIVED' as 'RECEIVED' | 'SHIPPED' | 'RETURNED' | 'ADJUSTMENT',
    quantity: 0,
    notes: '',
  })

  // Allocate form
  const [allocateForm, setAllocateForm] = useState({
    purchaseOrderId: '',
    quantity: 0,
  })
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([])

  const fetchItems = useCallback(async (
    search: string = '',
    cat: string = '',
    lowStock: boolean = false,
    sort: SortField = 'name',
    direction: 'asc' | 'desc' = 'asc',
    pg: number = 1
  ) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        search,
        category: cat,
        lowStock: lowStock.toString(),
        sortBy: sort,
        sortDirection: direction,
        page: pg.toString(),
        pageSize: '20',
      })

      const response = await fetch(`/api/v1/inventory?${params}`)
      const result: InventoryResponse = await response.json()

      if (result.success && result.data) {
        setItems(result.data.items)
        setTotal(result.data.total)
        setPage(result.data.page)
        setTotalPages(result.data.totalPages)
      } else {
        setError(result.error || 'Failed to load inventory')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchKPIs = useCallback(async () => {
    try {
      // Fetch all items for KPI calculations
      const allRes = await fetch('/api/v1/inventory?pageSize=1000')
      const allData: InventoryResponse = await allRes.json()

      if (allData.success && allData.data) {
        const allItems = allData.data.items
        setTotalItems(allData.data.total)
        setTotalValue(
          allItems.reduce(
            (sum, item) => sum + (item.quantityOnHand * (item.unitCost || 0)),
            0
          )
        )
        setReservedCount(
          allItems.reduce((sum, item) => sum + item.quantityReserved, 0)
        )
      }

      // Fetch low stock count
      const lowRes = await fetch('/api/v1/inventory/low-stock')
      const lowData: LowStockResponse = await lowRes.json()
      if (lowData.success && lowData.data) {
        setLowStockCount(lowData.data.count)
      }
    } catch {
      // KPI fetch failure is non-critical
    }
  }, [])

  const debouncedSearch = useCallback(
    debounce((search: string) => {
      fetchItems(search, categoryFilter, lowStockOnly, sortBy, sortDirection, 1)
    }, 300),
    [categoryFilter, lowStockOnly, sortBy, sortDirection]
  )

  useEffect(() => {
    fetchItems()
    fetchKPIs()
  }, [fetchItems, fetchKPIs])

  useEffect(() => {
    if (searchQuery !== '') {
      debouncedSearch(searchQuery)
    } else {
      fetchItems('', categoryFilter, lowStockOnly, sortBy, sortDirection, 1)
    }
  }, [searchQuery])

  const handleSort = (field: SortField) => {
    const newDirection = sortBy === field && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortBy(field)
    setSortDirection(newDirection)
    fetchItems(searchQuery, categoryFilter, lowStockOnly, field, newDirection, 1)
  }

  const handleCategoryChange = (value: string) => {
    const cat = value === 'ALL' ? '' : value
    setCategoryFilter(cat)
    fetchItems(searchQuery, cat, lowStockOnly, sortBy, sortDirection, 1)
  }

  const handleLowStockToggle = (checked: boolean) => {
    setLowStockOnly(checked)
    fetchItems(searchQuery, categoryFilter, checked, sortBy, sortDirection, 1)
  }

  const handlePageChange = (newPage: number) => {
    fetchItems(searchQuery, categoryFilter, lowStockOnly, sortBy, sortDirection, newPage)
  }

  // Categories derived from items
  const categories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean) as string[])
  ).sort()

  // Add item
  const handleAddItem = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/v1/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          sku: addForm.sku || undefined,
          description: addForm.description || undefined,
          category: addForm.category || undefined,
          location: addForm.location || undefined,
          unitCost: addForm.unitCost || undefined,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setAddDialogOpen(false)
        setAddForm({ name: '', sku: '', description: '', category: '', quantityOnHand: 0, reorderPoint: 0, location: '', unitCost: 0 })
        fetchItems(searchQuery, categoryFilter, lowStockOnly, sortBy, sortDirection, page)
        fetchKPIs()
      } else {
        setError(result.error || 'Failed to add item')
      }
    } catch {
      setError('Failed to add item')
    } finally {
      setSubmitting(false)
    }
  }

  // Adjust stock
  const handleAdjustStock = async () => {
    if (!selectedItem) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/v1/inventory/${selectedItem.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustForm),
      })
      const result = await response.json()
      if (result.success) {
        setAdjustDialogOpen(false)
        setAdjustForm({ type: 'RECEIVED', quantity: 0, notes: '' })
        setSelectedItem(null)
        fetchItems(searchQuery, categoryFilter, lowStockOnly, sortBy, sortDirection, page)
        fetchKPIs()
      } else {
        setError(result.error || 'Failed to adjust stock')
      }
    } catch {
      setError('Failed to adjust stock')
    } finally {
      setSubmitting(false)
    }
  }

  // Allocate stock
  const handleAllocateStock = async () => {
    if (!selectedItem) return
    setSubmitting(true)
    try {
      const response = await fetch(`/api/v1/inventory/${selectedItem.id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allocateForm),
      })
      const result = await response.json()
      if (result.success) {
        setAllocateDialogOpen(false)
        setAllocateForm({ purchaseOrderId: '', quantity: 0 })
        setSelectedItem(null)
        fetchItems(searchQuery, categoryFilter, lowStockOnly, sortBy, sortDirection, page)
        fetchKPIs()
      } else {
        setError(result.error || 'Failed to allocate stock')
      }
    } catch {
      setError('Failed to allocate stock')
    } finally {
      setSubmitting(false)
    }
  }

  // Fetch POs for allocation dialog
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

  const openAdjustDialog = (item: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedItem(item)
    setAdjustForm({ type: 'RECEIVED', quantity: 0, notes: '' })
    setAdjustDialogOpen(true)
  }

  const openAllocateDialog = (item: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedItem(item)
    setAllocateForm({ purchaseOrderId: '', quantity: 0 })
    fetchPurchaseOrders()
    setAllocateDialogOpen(true)
  }

  const getStockLevel = (item: InventoryItem) => {
    if (item.reorderPoint <= 0) return 'normal'
    if (item.quantityOnHand <= 0) return 'critical'
    if (item.quantityOnHand <= item.reorderPoint) return 'low'
    return 'normal'
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">
            Track stock levels, adjustments, and allocations
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Items"
          value={totalItems}
          icon={<Package className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(totalValue)}
          icon={<DollarSign className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockCount}
          icon={<AlertTriangle className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Reserved Units"
          value={reservedCount}
          icon={<Lock className="h-5 w-5 text-primary" />}
        />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter || 'ALL'} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                checked={lowStockOnly}
                onCheckedChange={handleLowStockToggle}
              />
              <Label className="text-sm text-muted-foreground cursor-pointer">
                Show Low Stock Only
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Items ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading inventory..." />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Warehouse className="h-8 w-8 text-muted-foreground" />}
              title="No inventory items found"
              description={
                searchQuery || categoryFilter || lowStockOnly
                  ? 'No items match your current filters. Try adjusting your search.'
                  : 'Add your first inventory item to get started.'
              }
              action={
                !searchQuery && !categoryFilter && !lowStockOnly
                  ? { label: 'Add Item', onClick: () => setAddDialogOpen(true) }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          className="flex items-center font-medium hover:text-foreground transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          Name
                          <SortIcon field="name" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          className="flex items-center font-medium hover:text-foreground transition-colors"
                          onClick={() => handleSort('sku')}
                        >
                          SKU
                          <SortIcon field="sku" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          className="flex items-center font-medium hover:text-foreground transition-colors"
                          onClick={() => handleSort('category')}
                        >
                          Category
                          <SortIcon field="category" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center font-medium hover:text-foreground transition-colors ml-auto"
                          onClick={() => handleSort('quantityOnHand')}
                        >
                          On Hand
                          <SortIcon field="quantityOnHand" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Reserved</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Reorder Pt</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center font-medium hover:text-foreground transition-colors ml-auto"
                          onClick={() => handleSort('unitCost')}
                        >
                          Unit Cost
                          <SortIcon field="unitCost" />
                        </button>
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const stockLevel = getStockLevel(item)
                      const available = item.quantityOnHand - item.quantityReserved
                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            'cursor-pointer hover:bg-muted/50 transition-colors',
                            stockLevel === 'critical' && 'bg-red-50/50',
                            stockLevel === 'low' && 'bg-amber-50/50'
                          )}
                          onClick={() => router.push(`/inventory/${item.id}`)}
                        >
                          <TableCell>
                            <span className="font-medium">{item.name}</span>
                          </TableCell>
                          <TableCell>
                            {item.sku ? (
                              <Badge variant="secondary" className="text-xs font-mono">
                                {item.sku}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.category ? (
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Uncategorized</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-medium tabular-nums',
                                stockLevel === 'critical' && 'text-red-600',
                                stockLevel === 'low' && 'text-amber-600'
                              )}
                            >
                              {item.quantityOnHand}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="tabular-nums text-muted-foreground">
                              {item.quantityReserved}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                'font-medium tabular-nums',
                                available <= 0 && 'text-red-600'
                              )}
                            >
                              {available}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="tabular-nums text-muted-foreground">
                              {item.reorderPoint}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {item.location || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm tabular-nums">
                              {item.unitCost != null ? formatCurrency(item.unitCost) : 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => openAdjustDialog(item, e)}
                              >
                                Adjust
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => openAllocateDialog(item, e)}
                              >
                                Allocate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} items)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>
              Create a new item to track in your inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name *</Label>
              <Input
                id="add-name"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="Item name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-sku">SKU</Label>
                <Input
                  id="add-sku"
                  value={addForm.sku}
                  onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                  placeholder="e.g. WDG-001"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-category">Category</Label>
                <Input
                  id="add-category"
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  placeholder="e.g. Office Supplies"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-description">Description</Label>
              <Textarea
                id="add-description"
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-qty">Initial Quantity</Label>
                <Input
                  id="add-qty"
                  type="number"
                  min={0}
                  value={addForm.quantityOnHand}
                  onChange={(e) => setAddForm({ ...addForm, quantityOnHand: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-reorder">Reorder Point</Label>
                <Input
                  id="add-reorder"
                  type="number"
                  min={0}
                  value={addForm.reorderPoint}
                  onChange={(e) => setAddForm({ ...addForm, reorderPoint: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-location">Location</Label>
                <Input
                  id="add-location"
                  value={addForm.location}
                  onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                  placeholder="e.g. Warehouse A, Shelf 3"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-cost">Unit Cost ($)</Label>
                <Input
                  id="add-cost"
                  type="number"
                  min={0}
                  step={0.01}
                  value={addForm.unitCost}
                  onChange={(e) => setAddForm({ ...addForm, unitCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!addForm.name || submitting}
            >
              {submitting ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  Adjusting stock for <strong>{selectedItem.name}</strong>.
                  Current on hand: {selectedItem.quantityOnHand}
                </>
              )}
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
              <Label htmlFor="adjust-qty">
                {adjustForm.type === 'ADJUSTMENT' ? 'New Quantity' : 'Quantity'}
              </Label>
              <Input
                id="adjust-qty"
                type="number"
                min={adjustForm.type === 'ADJUSTMENT' ? 0 : 1}
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjust-notes">Notes</Label>
              <Textarea
                id="adjust-notes"
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
              {selectedItem && (
                <>
                  Allocating <strong>{selectedItem.name}</strong>.
                  Available: {selectedItem.quantityOnHand - selectedItem.quantityReserved} units
                </>
              )}
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
              <Label htmlFor="allocate-qty">Quantity</Label>
              <Input
                id="allocate-qty"
                type="number"
                min={1}
                max={selectedItem ? selectedItem.quantityOnHand - selectedItem.quantityReserved : 0}
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
