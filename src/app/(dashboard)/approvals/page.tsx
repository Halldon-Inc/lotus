'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import { ApprovalConfig } from '@/components/shared/approval-config'
import {
  ShieldCheck,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  ListChecks,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import type { ApprovalRule, ApprovalRequestWithDetails } from '@/types'

type TabValue = 'pending' | 'rules'

interface ApprovalRequestItem {
  id: string
  entityType: string
  entityId: string
  status: string
  requestedAt: string
  resolvedAt: string | null
  notes: string | null
  rule: {
    id: string
    name: string
    conditionField: string
    conditionOp: string
    conditionValue: string
  } | null
  requestedBy: {
    id: string
    name: string
    email: string
  }
  approver: {
    id: string
    name: string
  } | null
  createdAt: string
}

interface ApprovalRuleItem {
  id: string
  name: string
  entityType: string
  conditionField: string
  conditionOp: string
  conditionValue: string
  approverRole: string | null
  priority: number
  isActive: boolean
  createdAt: string
}

const ENTITY_LINK_MAP: Record<string, string> = {
  PURCHASE_ORDER: '/orders',
  INVOICE: '/invoices',
  REQUEST: '/requests',
}

const ENTITY_LABEL_MAP: Record<string, string> = {
  PURCHASE_ORDER: 'Purchase Order',
  INVOICE: 'Invoice',
  REQUEST: 'Request',
}

const OP_LABEL_MAP: Record<string, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  eq: '=',
}

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabValue>('pending')
  const [loading, setLoading] = useState(true)
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequestItem[]>([])
  const [allApprovals, setAllApprovals] = useState<ApprovalRequestItem[]>([])
  const [rules, setRules] = useState<ApprovalRuleItem[]>([])
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({})
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const isAdmin = session?.user?.role === 'ADMIN'

  const fetchApprovals = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/approvals?pageSize=100&sortBy=createdAt&sortDirection=desc')
      const result = await response.json()

      if (result.success && result.data) {
        const items: ApprovalRequestItem[] = result.data.items || result.data
        setAllApprovals(items)
        setPendingApprovals(items.filter((a: ApprovalRequestItem) => a.status === 'PENDING'))
      }
    } catch (error) {
      console.error('Error fetching approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/v1/approvals/rules')
      const result = await response.json()

      if (result.success && result.data) {
        setRules(result.data.items || result.data)
      }
    } catch (error) {
      console.error('Error fetching rules:', error)
    }
  }

  useEffect(() => {
    fetchApprovals()
    fetchRules()
  }, [])

  const handleApprovalAction = async (approvalId: string, action: 'APPROVED' | 'REJECTED') => {
    setProcessingIds((prev) => new Set(prev).add(approvalId))
    try {
      const response = await fetch(`/api/v1/approvals/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action,
          notes: actionNotes[approvalId] || undefined,
        }),
      })

      if (response.ok) {
        setActionNotes((prev) => {
          const next = { ...prev }
          delete next[approvalId]
          return next
        })
        fetchApprovals()
      }
    } catch (error) {
      console.error('Error processing approval:', error)
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(approvalId)
        return next
      })
    }
  }

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      await fetch(`/api/v1/approvals/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      fetchRules()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await fetch(`/api/v1/approvals/rules/${ruleId}`, {
        method: 'DELETE',
      })
      fetchRules()
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  // KPI calculations
  const approvedToday = allApprovals.filter((a) => {
    if (a.status !== 'APPROVED' || !a.resolvedAt) return false
    const resolved = new Date(a.resolvedAt)
    const today = new Date()
    return (
      resolved.getDate() === today.getDate() &&
      resolved.getMonth() === today.getMonth() &&
      resolved.getFullYear() === today.getFullYear()
    )
  }).length

  const rejectedToday = allApprovals.filter((a) => {
    if (a.status !== 'REJECTED' || !a.resolvedAt) return false
    const resolved = new Date(a.resolvedAt)
    const today = new Date()
    return (
      resolved.getDate() === today.getDate() &&
      resolved.getMonth() === today.getMonth() &&
      resolved.getFullYear() === today.getFullYear()
    )
  }).length

  const activeRules = rules.filter((r) => r.isActive).length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Approvals</h1>
          <p className="text-muted-foreground">
            Review pending approvals and manage approval rules
          </p>
        </div>
        {isAdmin && (
          <Button className="lotus-button" onClick={() => setShowCreateRule(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingApprovals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved Today</p>
                <p className="text-2xl font-bold">{approvedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rejected Today</p>
                <p className="text-2xl font-bold">{rejectedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{activeRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="mr-2 inline h-4 w-4" />
          Pending Approvals
          {pendingApprovals.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingApprovals.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'rules'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ListChecks className="mr-2 inline h-4 w-4" />
          Approval Rules
          <Badge variant="secondary" className="ml-2">
            {rules.length}
          </Badge>
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <LoadingState message="Loading approvals..." />
      ) : activeTab === 'pending' ? (
        /* Pending Approvals Tab */
        pendingApprovals.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<ShieldCheck className="h-8 w-8 text-muted-foreground" />}
                title="All caught up!"
                description="There are no pending approvals at this time."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingApprovals.map((approval) => (
              <Card key={approval.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: Approval Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {ENTITY_LABEL_MAP[approval.entityType] || approval.entityType}
                        </Badge>
                        <StatusPill status={approval.status} size="sm" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Entity:
                          </span>
                          <Link
                            href={`${ENTITY_LINK_MAP[approval.entityType] || '#'}/${approval.entityId}`}
                            className="text-sm font-mono text-primary hover:underline"
                          >
                            {approval.entityId.slice(0, 8)}...
                          </Link>
                        </div>

                        {approval.rule && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              Rule:
                            </span>
                            <span className="text-sm">
                              {approval.rule.name} ({approval.rule.conditionField}{' '}
                              {OP_LABEL_MAP[approval.rule.conditionOp] || approval.rule.conditionOp}{' '}
                              {approval.rule.conditionValue})
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Requested by:
                          </span>
                          <span className="text-sm">{approval.requestedBy.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Requested:
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeTime(approval.requestedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Notes Input */}
                      <Textarea
                        placeholder="Add a note (optional)..."
                        className="max-w-md resize-none"
                        rows={2}
                        value={actionNotes[approval.id] || ''}
                        onChange={(e) =>
                          setActionNotes((prev) => ({
                            ...prev,
                            [approval.id]: e.target.value,
                          }))
                        }
                      />
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={processingIds.has(approval.id)}
                        onClick={() => handleApprovalAction(approval.id, 'APPROVED')}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={processingIds.has(approval.id)}
                        onClick={() => handleApprovalAction(approval.id, 'REJECTED')}
                      >
                        <ThumbsDown className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* Rules Tab */
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Approval Rules</CardTitle>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateRule(true)}
              >
                <Plus className="mr-2 h-3 w-3" />
                Add Rule
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <EmptyState
                icon={<ListChecks className="h-8 w-8 text-muted-foreground" />}
                title="No approval rules"
                description="Create rules to require approvals for specific conditions."
                action={
                  isAdmin
                    ? { label: 'Create Rule', onClick: () => setShowCreateRule(true) }
                    : undefined
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Approver Role</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Active</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <span className="font-medium">{rule.name}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ENTITY_LABEL_MAP[rule.entityType] || rule.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">
                          {rule.conditionField} {OP_LABEL_MAP[rule.conditionOp] || rule.conditionOp}{' '}
                          {rule.conditionValue}
                        </span>
                      </TableCell>
                      <TableCell>
                        {rule.approverRole ? (
                          <Badge variant="secondary">{rule.approverRole}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Any</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{rule.priority}</span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                          disabled={!isAdmin}
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Rule Dialog */}
      <ApprovalConfig
        open={showCreateRule}
        onOpenChange={setShowCreateRule}
        onSuccess={() => {
          fetchRules()
        }}
      />
    </div>
  )
}
