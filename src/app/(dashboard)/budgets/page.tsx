'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { StatCard } from '@/components/shared/stat-card'
import {
  Wallet,
  Plus,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PiggyBank,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface BudgetClient {
  id: string
  name: string
  type: string
}

interface Budget {
  id: string
  clientId: string
  fiscalYear: number
  department: string | null
  totalBudget: number
  encumbered: number
  spent: number
  notes: string | null
  available: number
  utilizationPct: number
  createdAt: string
  updatedAt: string
  client: BudgetClient
}

interface BudgetsResponse {
  success: boolean
  data?: Budget[]
  error?: string
}

interface ClientOption {
  id: string
  name: string
  type: string
}

interface ClientsResponse {
  success: boolean
  data?: {
    items: ClientOption[]
  }
  error?: string
}

export default function BudgetsPage() {
  const { data: session } = useSession()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])

  // Form state
  const [form, setForm] = useState({
    clientId: '',
    fiscalYear: new Date().getFullYear(),
    totalBudget: 0,
    department: '',
    notes: '',
  })

  const fetchBudgets = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/v1/budgets')
      const result: BudgetsResponse = await response.json()

      if (result.success && result.data) {
        setBudgets(result.data)
      } else {
        setError(result.error || 'Failed to load budgets')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/v1/clients?pageSize=100&sortBy=name&sortDirection=asc')
      const result: ClientsResponse = await response.json()
      if (result.success && result.data) {
        setClients(result.data.items)
      }
    } catch {
      // Non-critical
    }
  }

  useEffect(() => {
    fetchBudgets()
  }, [])

  const handleOpenDialog = () => {
    fetchClients()
    setForm({
      clientId: '',
      fiscalYear: new Date().getFullYear(),
      totalBudget: 0,
      department: '',
      notes: '',
    })
    setDialogOpen(true)
  }

  const handleCreateBudget = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/v1/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: form.clientId,
          fiscalYear: form.fiscalYear,
          totalBudget: form.totalBudget,
          department: form.department || undefined,
          notes: form.notes || undefined,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setDialogOpen(false)
        fetchBudgets()
      } else {
        setError(result.error || 'Failed to create budget')
      }
    } catch {
      setError('Failed to create budget')
    } finally {
      setSubmitting(false)
    }
  }

  const getUtilizationColor = (pct: number) => {
    if (pct > 85) return 'text-red-600'
    if (pct >= 60) return 'text-amber-600'
    return 'text-green-600'
  }

  const getUtilizationBg = (pct: number) => {
    if (pct > 85) return 'bg-red-50/50'
    if (pct >= 60) return 'bg-amber-50/50'
    return ''
  }

  const canManageBudgets =
    session?.user.role && ['ADMIN', 'MANAGER'].includes(session.user.role)

  // KPI calculations
  const totalBudgetAmount = budgets.reduce((sum, b) => sum + b.totalBudget, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)
  const totalEncumbered = budgets.reduce((sum, b) => sum + b.encumbered, 0)
  const overBudgetCount = budgets.filter((b) => b.utilizationPct > 85).length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budgets</h1>
          <p className="text-muted-foreground">
            Track client budget allocations, encumbrances, and spending
          </p>
        </div>
        {canManageBudgets && (
          <Button className="lotus-button" onClick={handleOpenDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Budget
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Budgeted"
          value={formatCurrency(totalBudgetAmount)}
          icon={<PiggyBank className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Total Spent"
          value={formatCurrency(totalSpent)}
          icon={<DollarSign className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Total Encumbered"
          value={formatCurrency(totalEncumbered)}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Over 85% Utilized"
          value={overBudgetCount}
          icon={<AlertTriangle className="h-5 w-5 text-primary" />}
        />
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

      {/* Budgets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Budgets ({budgets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading budgets..." />
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-8 w-8 text-muted-foreground" />}
              title="No budgets found"
              description="Create your first budget to start tracking client spending."
              action={
                canManageBudgets
                  ? { label: 'Add Budget', onClick: handleOpenDialog }
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Fiscal Year</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Total Budget</TableHead>
                    <TableHead className="text-right">Encumbered</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Utilization %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => (
                    <TableRow
                      key={budget.id}
                      className={cn(
                        'transition-colors',
                        getUtilizationBg(budget.utilizationPct)
                      )}
                    >
                      <TableCell>
                        <span className="font-medium">{budget.client.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums">{budget.fiscalYear}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {budget.department || 'General'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium tabular-nums">
                          {formatCurrency(budget.totalBudget)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="tabular-nums text-muted-foreground">
                          {formatCurrency(budget.encumbered)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="tabular-nums text-muted-foreground">
                          {formatCurrency(budget.spent)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            budget.available <= 0 && 'text-red-600'
                          )}
                        >
                          {formatCurrency(budget.available)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            getUtilizationColor(budget.utilizationPct)
                          )}
                        >
                          {budget.utilizationPct.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Budget</DialogTitle>
            <DialogDescription>
              Create a new budget allocation for a client fiscal year.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="budget-client">Client *</Label>
              <Select
                value={form.clientId}
                onValueChange={(value) =>
                  setForm({ ...form, clientId: value })
                }
              >
                <SelectTrigger id="budget-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="budget-year">Fiscal Year *</Label>
                <Input
                  id="budget-year"
                  type="number"
                  min={2020}
                  max={2040}
                  value={form.fiscalYear}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fiscalYear: parseInt(e.target.value) || new Date().getFullYear(),
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budget-total">Total Budget ($) *</Label>
                <Input
                  id="budget-total"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.totalBudget}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      totalBudget: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget-dept">Department</Label>
              <Input
                id="budget-dept"
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                placeholder="e.g. IT, Facilities, General"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget-notes">Notes</Label>
              <Textarea
                id="budget-notes"
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                placeholder="Optional notes about this budget"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateBudget}
              disabled={!form.clientId || form.totalBudget <= 0 || submitting}
            >
              {submitting ? 'Creating...' : 'Create Budget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
