'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import { StatCard } from '@/components/shared/stat-card'
import {
  Truck,
  Package,
  PackageCheck,
  CheckCircle,
  AlertTriangle,
  Plus,
  Search,
  Calendar,
  Building2,
  Download,
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { ApiResponse } from '@/types'

interface ShipmentSummary {
  id: string
  purchaseOrderId: string
  method: string
  carrierName: string | null
  trackingNumber: string | null
  status: string
  scheduledDate: string | null
  shippedAt: string | null
  deliveredAt: string | null
  createdAt: string
  purchaseOrder: {
    id: string
    poNumber: string
    client: {
      id: string
      name: string
    }
  }
  _count: {
    items: number
  }
}

interface ReadyToShipPO {
  id: string
  poNumber: string
  totalAmount: number
  status: string
  client: {
    id: string
    name: string
  }
  _count: {
    items: number
  }
}

interface DeliveryStats {
  preparing: number
  ready: number
  inTransit: number
  deliveredThisWeek: number
  failed: number
}

export default function DeliveryPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [shipments, setShipments] = useState<ShipmentSummary[]>([])
  const [readyToShip, setReadyToShip] = useState<ReadyToShipPO[]>([])
  const [stats, setStats] = useState<DeliveryStats>({ preparing: 0, ready: 0, inTransit: 0, deliveredThisWeek: 0, failed: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Create shipment form
  const [creatingForPO, setCreatingForPO] = useState<string | null>(null)
  const [shipmentMethod, setShipmentMethod] = useState('CARRIER')
  const [carrierName, setCarrierName] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (methodFilter !== 'all') params.set('method', methodFilter)

      const [shipmentsRes, readyRes] = await Promise.all([
        fetch(`/api/v1/shipments?${params.toString()}`),
        fetch('/api/v1/shipments?view=ready-to-ship'),
      ])

      const shipmentsResult: ApiResponse<{ shipments: ShipmentSummary[]; stats: DeliveryStats }> = await shipmentsRes.json()
      const readyResult: ApiResponse<ReadyToShipPO[]> = await readyRes.json()

      if (shipmentsResult.success && shipmentsResult.data) {
        setShipments(shipmentsResult.data.shipments || [])
        setStats(shipmentsResult.data.stats || { preparing: 0, ready: 0, inTransit: 0, deliveredThisWeek: 0, failed: 0 })
      }
      if (readyResult.success && readyResult.data) {
        setReadyToShip(readyResult.data)
      }
    } catch {
      setError('Failed to load delivery data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, methodFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createShipment = async (poId: string) => {
    try {
      setCreating(true)
      const response = await fetch('/api/v1/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: poId,
          method: shipmentMethod,
          carrierName: shipmentMethod === 'CARRIER' ? carrierName : undefined,
          scheduledDate: scheduledDate || undefined,
          items: [], // API will auto-populate all PO items
        }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        setCreatingForPO(null)
        setShipmentMethod('CARRIER')
        setCarrierName('')
        setScheduledDate('')
        fetchData()
      }
    } catch {
      console.error('Failed to create shipment')
    } finally {
      setCreating(false)
    }
  }

  const hasManualShipments = shipments.some((s) => s.method === 'MANUAL')

  const exportToDetrack = async () => {
    try {
      setExporting(true)
      const response = await fetch('/api/v1/shipments/export/detrack')
      if (!response.ok) {
        console.error('Detrack export failed:', response.statusText)
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const disposition = response.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename=(.+)/)
      const filename = filenameMatch ? filenameMatch[1] : 'detrack-upload.csv'
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      console.error('Failed to export Detrack CSV')
    } finally {
      setExporting(false)
    }
  }

  const filteredShipments = shipments.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.purchaseOrder.poNumber.toLowerCase().includes(q) ||
      s.purchaseOrder.client.name.toLowerCase().includes(q) ||
      (s.carrierName || '').toLowerCase().includes(q) ||
      (s.trackingNumber || '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return <LoadingState message="Loading delivery management..." size="lg" />
  }

  if (error) {
    return (
      <EmptyState
        icon={<Truck className="h-8 w-8 text-muted-foreground" />}
        title="Failed to load deliveries"
        description={error}
        action={{ label: 'Retry', onClick: fetchData }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Delivery Management</h1>
          <p className="text-muted-foreground">Manage shipments and track deliveries</p>
        </div>
        {hasManualShipments && (
          <Button
            variant="outline"
            onClick={exportToDetrack}
            disabled={exporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export to Detrack'}
          </Button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard
          title="Preparing"
          value={stats.preparing}
          icon={<Package className="h-5 w-5" />}
        />
        <StatCard
          title="Ready to Ship"
          value={stats.ready}
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <StatCard
          title="In Transit"
          value={stats.inTransit}
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          title="Delivered (Week)"
          value={stats.deliveredThisWeek}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={<AlertTriangle className="h-5 w-5" />}
          className={stats.failed > 0 ? 'border-red-200' : ''}
        />
      </div>

      {/* Ready to Ship Section */}
      {readyToShip.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              <span>Ready to Ship</span>
              <Badge variant="secondary">{readyToShip.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {readyToShip.map((po) => (
                <Card key={po.id} className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-medium text-sm">{po.poNumber}</span>
                      <StatusPill status={po.status} size="sm" />
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground mb-1">
                      <Building2 className="h-3 w-3" />
                      <span>{po.client.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                      <span>{po._count.items} items</span>
                      <span>{formatCurrency(po.totalAmount)}</span>
                    </div>

                    {creatingForPO === po.id ? (
                      <div className="space-y-3 border-t pt-3">
                        <Select value={shipmentMethod} onValueChange={setShipmentMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CARRIER">Carrier</SelectItem>
                            <SelectItem value="MANUAL">Manual Delivery</SelectItem>
                          </SelectContent>
                        </Select>
                        {shipmentMethod === 'CARRIER' && (
                          <Input
                            placeholder="Carrier name (e.g. UPS, FedEx)"
                            value={carrierName}
                            onChange={(e) => setCarrierName(e.target.value)}
                          />
                        )}
                        <Input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="lotus-button flex-1"
                            onClick={() => createShipment(po.id)}
                            disabled={creating}
                          >
                            {creating ? 'Creating...' : 'Create'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCreatingForPO(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="lotus-button w-full"
                        onClick={() => setCreatingForPO(po.id)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Shipment
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Shipments */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Active Shipments</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search shipments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PREPARING">Preparing</SelectItem>
                  <SelectItem value="READY">Ready</SelectItem>
                  <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                  <SelectItem value="DELIVERED">Delivered</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="CARRIER">Carrier</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredShipments.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-8 w-8 text-muted-foreground" />}
              title="No shipments found"
              description={searchQuery ? 'Try adjusting your search or filters.' : 'Shipments will appear here once created.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/delivery/${shipment.id}`)}
                    >
                      <TableCell className="font-mono font-medium">
                        {shipment.purchaseOrder.poNumber}
                      </TableCell>
                      <TableCell>{shipment.purchaseOrder.client.name}</TableCell>
                      <TableCell>
                        <StatusPill status={shipment.method} size="sm" />
                      </TableCell>
                      <TableCell className="text-sm">
                        {shipment.carrierName || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">
                          {shipment.trackingNumber || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill status={shipment.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-sm">
                        {shipment.scheduledDate ? formatDate(shipment.scheduledDate) : 'Not set'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {shipment._count.items}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
