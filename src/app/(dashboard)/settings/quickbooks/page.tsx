'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  FileText,
  Receipt,
  Loader2,
  Info,
  Unplug,
  Link2,
  Download,
  AlertTriangle,
  Package,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface QBStatus {
  connected: boolean
  companyName?: string
  realmId?: string
  lastSyncAt?: string
  environment?: 'sandbox' | 'production'
  tokenExpiresAt?: string
}

interface SyncResult {
  synced?: number
  customers?: number
  bills?: number
  invoices?: number
  errors?: string[]
}

type SyncTarget = 'customers' | 'bills' | 'invoices' | 'full'

type ImportTarget = 'customers' | 'vendors' | 'invoices'

interface ImportResult {
  success: boolean
  message: string
  details?: {
    imported?: number
    updated?: number
    skipped?: number
    count?: number
    vendors?: string[]
    errors?: string[]
  }
}

export default function QuickBooksSettingsPage() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<QBStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [syncLoading, setSyncLoading] = useState<Record<SyncTarget, boolean>>({
    customers: false,
    bills: false,
    invoices: false,
    full: false,
  })
  const [syncResults, setSyncResults] = useState<Record<SyncTarget, { success: boolean; message: string } | null>>({
    customers: null,
    bills: null,
    invoices: null,
    full: null,
  })

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const [importLoading, setImportLoading] = useState<Record<ImportTarget, boolean>>({
    customers: false,
    vendors: false,
    invoices: false,
  })
  const [importResults, setImportResults] = useState<Record<ImportTarget, ImportResult | null>>({
    customers: null,
    vendors: null,
    invoices: null,
  })

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/v1/quickbooks/status')
      const result = await response.json()
      if (result.success && result.data) {
        setStatus(result.data)
      } else {
        setError(result.error || 'Failed to fetch QuickBooks status')
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleConnect = () => {
    window.location.href = '/api/v1/quickbooks/connect'
  }

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      const response = await fetch('/api/v1/quickbooks/disconnect', {
        method: 'POST',
      })
      const result = await response.json()
      if (result.success) {
        setStatus({ connected: false })
        setDisconnectDialogOpen(false)
      } else {
        setError(result.error || 'Failed to disconnect')
      }
    } catch {
      setError('Failed to disconnect from QuickBooks')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSync = async (target: SyncTarget) => {
    const endpoint = target === 'full'
      ? '/api/v1/quickbooks/sync'
      : `/api/v1/quickbooks/sync/${target}`

    setSyncLoading((prev) => ({ ...prev, [target]: true }))
    setSyncResults((prev) => ({ ...prev, [target]: null }))

    try {
      const response = await fetch(endpoint, { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        const data: SyncResult = result.data || {}
        let message = 'Sync completed successfully'

        if (target === 'full') {
          const parts: string[] = []
          if (data.customers !== undefined) parts.push(`${data.customers} customers`)
          if (data.bills !== undefined) parts.push(`${data.bills} bills`)
          if (data.invoices !== undefined) parts.push(`${data.invoices} invoices`)
          if (parts.length > 0) message = `Synced ${parts.join(', ')}`
        } else if (data.synced !== undefined) {
          message = `Synced ${data.synced} ${target}`
        }

        setSyncResults((prev) => ({ ...prev, [target]: { success: true, message } }))
        fetchStatus()
      } else {
        setSyncResults((prev) => ({
          ...prev,
          [target]: { success: false, message: result.error || 'Sync failed' },
        }))
      }
    } catch {
      setSyncResults((prev) => ({
        ...prev,
        [target]: { success: false, message: 'Network error during sync' },
      }))
    } finally {
      setSyncLoading((prev) => ({ ...prev, [target]: false }))
    }
  }

  const handleImport = async (target: ImportTarget) => {
    const endpoint = `/api/v1/quickbooks/import/${target}`

    setImportLoading((prev) => ({ ...prev, [target]: true }))
    setImportResults((prev) => ({ ...prev, [target]: null }))

    try {
      const response = await fetch(endpoint, { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        const data = result.data || {}
        let message = 'Import completed'

        if (target === 'customers') {
          const parts: string[] = []
          if (data.imported) parts.push(`${data.imported} imported`)
          if (data.updated) parts.push(`${data.updated} updated`)
          if (data.skipped) parts.push(`${data.skipped} skipped`)
          message = parts.length > 0 ? parts.join(', ') : 'No new customers found'
        } else if (target === 'vendors') {
          message = `Found ${data.count || 0} vendors`
        } else if (target === 'invoices') {
          const parts: string[] = []
          if (data.imported) parts.push(`${data.imported} imported`)
          if (data.updated) parts.push(`${data.updated} updated`)
          if (data.skipped) parts.push(`${data.skipped} skipped`)
          message = parts.length > 0 ? parts.join(', ') : 'No new invoices found'
        }

        setImportResults((prev) => ({
          ...prev,
          [target]: { success: true, message, details: data },
        }))
      } else {
        setImportResults((prev) => ({
          ...prev,
          [target]: { success: false, message: result.error || 'Import failed' },
        }))
      }
    } catch {
      setImportResults((prev) => ({
        ...prev,
        [target]: { success: false, message: 'Network error during import' },
      }))
    } finally {
      setImportLoading((prev) => ({ ...prev, [target]: false }))
    }
  }

  const anyImportRunning = Object.values(importLoading).some(Boolean)

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const isAdmin = session?.user.role === 'ADMIN'
  const anySyncRunning = Object.values(syncLoading).some(Boolean)

  if (loading) {
    return <LoadingState message="Checking QuickBooks connection..." size="lg" />
  }

  if (error && !status) {
    return (
      <div className="space-y-6">
        <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Settings
        </Link>
        <EmptyState
          icon={<XCircle className="h-8 w-8 text-muted-foreground" />}
          title="Connection Error"
          description={error}
          action={{ label: 'Retry', onClick: fetchStatus }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link and header */}
      <Link href="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Settings
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">QuickBooks Integration</h1>
            {status?.environment && (
              <Badge
                variant="outline"
                className={status.environment === 'production'
                  ? 'border-blue-300 text-blue-700 bg-blue-50'
                  : 'border-amber-300 text-amber-700 bg-amber-50'
                }
              >
                {status.environment === 'production' ? 'Production' : 'Sandbox'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Connect your QuickBooks Online account to sync customers, bills, and invoices
          </p>
        </div>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-700">Connected</span>
                    <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                  </div>
                  {status.companyName && (
                    <p className="text-sm text-muted-foreground">{status.companyName}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 rounded-lg border p-4 bg-muted/30">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</p>
                  <p className="text-sm font-medium mt-1">{status.companyName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Realm ID</p>
                  <p className="text-sm font-mono mt-1">{status.realmId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Sync</p>
                  <p className="text-sm mt-1">{formatLastSync(status.lastSyncAt)}</p>
                </div>
              </div>

              {isAdmin && (
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                  >
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <XCircle className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Not Connected</span>
                  <p className="text-sm text-muted-foreground">
                    Connect your QuickBooks account to start syncing data
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-6 text-center">
                <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click below to authorize Lotus to access your QuickBooks Online account.
                  You will be redirected to Intuit to complete the connection.
                </p>
                <Button
                  onClick={handleConnect}
                  className="text-white font-semibold"
                  style={{ backgroundColor: '#2CA01C' }}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-11h4v2h-4v2h4v2h-4v2h6V7H10v2z" />
                  </svg>
                  Connect to QuickBooks
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Controls (only when connected) */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Individual syncs */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Sync Customers */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-medium">Customers</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sync Lotus clients to QuickBooks customers
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSync('customers')}
                    disabled={syncLoading.customers || anySyncRunning}
                  >
                    {syncLoading.customers ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Customers
                  </Button>
                  {syncResults.customers && (
                    <p className={`text-xs ${syncResults.customers.success ? 'text-green-600' : 'text-red-600'}`}>
                      {syncResults.customers.message}
                    </p>
                  )}
                </div>

                {/* Sync Bills */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    <span className="font-medium">Bills</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Push vendor invoices to QuickBooks as bills
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSync('bills')}
                    disabled={syncLoading.bills || anySyncRunning}
                  >
                    {syncLoading.bills ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Bills
                  </Button>
                  {syncResults.bills && (
                    <p className={`text-xs ${syncResults.bills.success ? 'text-green-600' : 'text-red-600'}`}>
                      {syncResults.bills.message}
                    </p>
                  )}
                </div>

                {/* Sync Invoices */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">Invoices</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Push client invoices to QuickBooks
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleSync('invoices')}
                    disabled={syncLoading.invoices || anySyncRunning}
                  >
                    {syncLoading.invoices ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Invoices
                  </Button>
                  {syncResults.invoices && (
                    <p className={`text-xs ${syncResults.invoices.success ? 'text-green-600' : 'text-red-600'}`}>
                      {syncResults.invoices.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Full Sync */}
              <div className="rounded-lg border-2 border-primary/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Full Sync</p>
                    <p className="text-xs text-muted-foreground">
                      Sync all customers, bills, and invoices at once
                    </p>
                  </div>
                  <Button
                    className="lotus-button"
                    onClick={() => handleSync('full')}
                    disabled={syncLoading.full || anySyncRunning}
                  >
                    {syncLoading.full ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Run Full Sync
                  </Button>
                </div>
                {syncResults.full && (
                  <p className={`text-sm ${syncResults.full.success ? 'text-green-600' : 'text-red-600'}`}>
                    {syncResults.full.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import from QuickBooks (only when connected) */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import from QuickBooks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Warning banner */}
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">This will import records from QuickBooks into Lotus.</p>
                  <p className="mt-1 text-amber-700">
                    Existing Lotus records matched by name or QuickBooks ID will be updated.
                    New records will be created.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Import Customers */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" style={{ color: '#2CA01C' }} />
                    <span className="font-medium">Customers</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pull customers from QuickBooks into Lotus clients
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleImport('customers')}
                    disabled={importLoading.customers || anyImportRunning}
                  >
                    {importLoading.customers ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Import Customers
                  </Button>
                  {importResults.customers && (
                    <div>
                      <p className={`text-xs ${importResults.customers.success ? 'text-green-600' : 'text-red-600'}`}>
                        {importResults.customers.message}
                      </p>
                      {importResults.customers.details?.errors && importResults.customers.details.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            {importResults.customers.details.errors.length} error(s)
                          </summary>
                          <ul className="mt-1 space-y-1">
                            {importResults.customers.details.errors.map((e, i) => (
                              <li key={i} className="text-xs text-red-500">{e}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>

                {/* Import Vendors */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" style={{ color: '#2CA01C' }} />
                    <span className="font-medium">Vendors</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pull vendor list from QuickBooks for reference
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleImport('vendors')}
                    disabled={importLoading.vendors || anyImportRunning}
                  >
                    {importLoading.vendors ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Import Vendors
                  </Button>
                  {importResults.vendors && (
                    <div>
                      <p className={`text-xs ${importResults.vendors.success ? 'text-green-600' : 'text-red-600'}`}>
                        {importResults.vendors.message}
                      </p>
                      {importResults.vendors.details?.vendors && importResults.vendors.details.vendors.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            View {importResults.vendors.details.vendors.length} vendor(s)
                          </summary>
                          <ul className="mt-1 space-y-1">
                            {importResults.vendors.details.vendors.map((v, i) => (
                              <li key={i} className="text-xs text-foreground">{v}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>

                {/* Import Invoices */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" style={{ color: '#2CA01C' }} />
                    <span className="font-medium">Invoices</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pull invoices from QuickBooks into Lotus
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleImport('invoices')}
                    disabled={importLoading.invoices || anyImportRunning}
                  >
                    {importLoading.invoices ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Import Invoices
                  </Button>
                  {importResults.invoices && (
                    <div>
                      <p className={`text-xs ${importResults.invoices.success ? 'text-green-600' : 'text-red-600'}`}>
                        {importResults.invoices.message}
                      </p>
                      {importResults.invoices.details?.errors && importResults.invoices.details.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            {importResults.invoices.details.errors.length} error(s)
                          </summary>
                          <ul className="mt-1 space-y-1">
                            {importResults.invoices.details.errors.map((e, i) => (
                              <li key={i} className="text-xs text-red-500">{e}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What does each sync do?</p>
              <ul className="space-y-1">
                <li>
                  <strong>Customers:</strong> Creates or updates QuickBooks customers from your Lotus client list.
                </li>
                <li>
                  <strong>Bills:</strong> Pushes matched vendor invoices into QuickBooks as bills (accounts payable).
                </li>
                <li>
                  <strong>Invoices:</strong> Pushes client invoices into QuickBooks as invoices (accounts receivable).
                </li>
                <li>
                  <strong>Full Sync:</strong> Runs all three syncs in sequence.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect QuickBooks?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will remove the connection between Lotus and QuickBooks Online.
              Previously synced data in QuickBooks will not be deleted, but no new
              syncs will occur until you reconnect.
            </p>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
