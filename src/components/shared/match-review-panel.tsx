'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusPill } from '@/components/shared/status-pill'
import {
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  FileText,
  Receipt,
  PackageCheck,
  DollarSign,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ApiResponse, MatchRecordWithDetails, MatchLineComparison } from '@/types'

interface MatchReviewPanelProps {
  matchId: string | null
  onClose: () => void
}

function getComparisonColor(match: 'MATCH' | 'PARTIAL' | 'MISMATCH'): string {
  switch (match) {
    case 'MATCH': return 'bg-green-50 text-green-800 border-green-200'
    case 'PARTIAL': return 'bg-yellow-50 text-yellow-800 border-yellow-200'
    case 'MISMATCH': return 'bg-red-50 text-red-800 border-red-200'
  }
}

function getComparisonIcon(match: 'MATCH' | 'PARTIAL' | 'MISMATCH') {
  switch (match) {
    case 'MATCH': return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'PARTIAL': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    case 'MISMATCH': return <XCircle className="h-4 w-4 text-red-600" />
  }
}

export function MatchReviewPanel({ matchId, onClose }: MatchReviewPanelProps) {
  const [matchRecord, setMatchRecord] = useState<MatchRecordWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overriding, setOverriding] = useState(false)
  const [showOverrideForm, setShowOverrideForm] = useState(false)

  const fetchMatch = useCallback(async () => {
    if (!matchId) return
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/v1/matching/${matchId}`)
      const result: ApiResponse<MatchRecordWithDetails> = await response.json()

      if (result.success && result.data) {
        setMatchRecord(result.data)
      } else {
        setError(result.error || 'Failed to load match record')
      }
    } catch (err) {
      setError('Failed to load match record')
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    if (matchId) {
      fetchMatch()
      setShowOverrideForm(false)
      setOverrideReason('')
    }
  }, [matchId, fetchMatch])

  const handleOverride = async () => {
    if (!matchId || !overrideReason.trim()) return
    try {
      setOverriding(true)
      const response = await fetch(`/api/v1/matching/${matchId}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: overrideReason.trim() }),
      })
      const result: ApiResponse = await response.json()
      if (result.success) {
        fetchMatch()
        setShowOverrideForm(false)
        setOverrideReason('')
      }
    } catch (err) {
      console.error('Failed to override match:', err)
    } finally {
      setOverriding(false)
    }
  }

  const isOpen = matchId !== null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Match Review</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            3-way comparison of Purchase Order, Invoice, and Received quantities.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingState message="Loading match details..." />
        ) : error || !matchRecord ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error || 'Match record not found'}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Match Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Purchase Order</p>
                      <p className="font-medium font-mono text-sm">
                        {matchRecord.purchaseOrder?.poNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Invoice</p>
                      <p className="font-medium font-mono text-sm">
                        {matchRecord.invoice?.invoiceNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <PackageCheck className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <StatusPill status={matchRecord.status} size="sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tolerance + Variance */}
            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center space-x-6">
                <div>
                  <p className="text-xs text-muted-foreground">Tolerance</p>
                  <p className="text-sm font-medium">{matchRecord.tolerancePercent}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Variance</p>
                  <p className={`text-sm font-bold ${matchRecord.totalVariance === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatCurrency(Math.abs(matchRecord.totalVariance))}
                    {matchRecord.totalVariance !== 0 && (
                      <span className="text-xs font-normal ml-1">
                        ({matchRecord.totalVariance > 0 ? 'over' : 'under'})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="text-sm font-medium">
                    {matchRecord.purchaseOrder?.client?.name || 'N/A'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDate(matchRecord.createdAt)}</p>
              </div>
            </div>

            {/* 3-Column Comparison Table */}
            <div>
              <h4 className="text-sm font-medium mb-3">Line Item Comparison</h4>
              {matchRecord.lineComparisons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No line comparison data available.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-4 gap-3 text-xs font-medium text-muted-foreground px-3">
                    <div>Item</div>
                    <div className="text-center">PO (Ordered)</div>
                    <div className="text-center">Invoice (Billed)</div>
                    <div className="text-center">Received</div>
                  </div>

                  {/* Rows */}
                  {matchRecord.lineComparisons.map((line) => {
                    const worstMatch = line.quantityMatch === 'MISMATCH' || line.priceMatch === 'MISMATCH'
                      ? 'MISMATCH'
                      : line.quantityMatch === 'PARTIAL' || line.priceMatch === 'PARTIAL'
                      ? 'PARTIAL'
                      : 'MATCH'

                    return (
                      <div
                        key={line.id}
                        className={`grid grid-cols-4 gap-3 rounded-lg border p-3 ${getComparisonColor(worstMatch)}`}
                      >
                        {/* Item Name */}
                        <div className="flex items-start space-x-2">
                          {getComparisonIcon(worstMatch)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{line.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getComparisonIcon(line.quantityMatch)}
                              <span className="text-xs">Qty</span>
                              {getComparisonIcon(line.priceMatch)}
                              <span className="text-xs">Price</span>
                            </div>
                          </div>
                        </div>

                        {/* PO Column */}
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {line.poQuantity != null ? line.poQuantity : '\u2014'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.poUnitPrice != null ? formatCurrency(line.poUnitPrice) : '\u2014'} / unit
                          </p>
                        </div>

                        {/* Invoice Column */}
                        <div className="text-center">
                          <p className="text-sm font-medium">{line.invoiceQuantity}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(line.invoiceUnitPrice)} / unit
                          </p>
                        </div>

                        {/* Received Column */}
                        <div className="text-center">
                          <p className="text-sm font-medium">
                            {line.receivedQuantity != null ? line.receivedQuantity : '\u2014'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Override Notes */}
            {matchRecord.status === 'MANUAL_OVERRIDE' && matchRecord.notes && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Manual Override</span>
                </div>
                <p className="text-sm text-purple-700">{matchRecord.notes}</p>
                {matchRecord.overrideBy && (
                  <p className="text-xs text-purple-600 mt-2">
                    By {matchRecord.overrideBy.name}
                    {matchRecord.overrideAt && ` on ${formatDate(matchRecord.overrideAt)}`}
                  </p>
                )}
              </div>
            )}

            {/* Manual Override Action */}
            {matchRecord.status !== 'MANUAL_OVERRIDE' && matchRecord.status !== 'AUTO_MATCHED' && (
              <div className="border-t pt-4">
                {!showOverrideForm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowOverrideForm(true)}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Manual Override
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Label>Override Reason</Label>
                    <Textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Explain why this match is being manually approved..."
                      rows={3}
                    />
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowOverrideForm(false)
                          setOverrideReason('')
                        }}
                        disabled={overriding}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleOverride}
                        disabled={overriding || !overrideReason.trim()}
                      >
                        {overriding ? 'Submitting...' : 'Confirm Override'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
