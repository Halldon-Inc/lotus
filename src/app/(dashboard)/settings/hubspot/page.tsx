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
  Loader2,
  Info,
  Zap,
  ArrowRight,
  Users,
  Building2,
  Handshake,
  AlertTriangle,
  Download,
} from 'lucide-react'

interface HubSpotStatus {
  connected: boolean
  portalId?: string
  lastSyncAt?: string
}

interface ImportResultData {
  imported: number
  updated?: number
  skipped: number
  errors: Array<{ hubspotId: string; name: string; error: string }>
}

type ImportType = 'contacts' | 'companies' | 'deals'

interface ImportState {
  loading: boolean
  result: ImportResultData | null
  error: string | null
}

export default function HubSpotSettingsPage() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<HubSpotStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)

  const [importStates, setImportStates] = useState<Record<ImportType, ImportState>>({
    contacts: { loading: false, result: null, error: null },
    companies: { loading: false, result: null, error: null },
    deals: { loading: false, result: null, error: null },
  })

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/v1/hubspot/status')
      const result = await response.json()
      if (result.success && result.data) {
        setStatus(result.data)
      } else {
        setError(result.error || 'Failed to fetch HubSpot status')
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

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const response = await fetch('/api/v1/hubspot/sync', { method: 'POST' })
      const result = await response.json()
      if (result.success) {
        const data = result.data || {}
        const updated = data.updated ?? data.synced ?? 0
        setSyncResult({
          success: true,
          message: `Sync complete: ${updated} deal${updated === 1 ? '' : 's'} updated`,
        })
        fetchStatus()
      } else {
        setSyncResult({
          success: false,
          message: result.error || 'Sync failed',
        })
      }
    } catch {
      setSyncResult({
        success: false,
        message: 'Network error during sync',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleImport = async (type: ImportType) => {
    setImportStates(prev => ({
      ...prev,
      [type]: { loading: true, result: null, error: null },
    }))

    try {
      const response = await fetch(`/api/v1/hubspot/import/${type}`, { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        setImportStates(prev => ({
          ...prev,
          [type]: { loading: false, result: data.data, error: null },
        }))
      } else {
        setImportStates(prev => ({
          ...prev,
          [type]: { loading: false, result: null, error: data.error || 'Import failed' },
        }))
      }
    } catch {
      setImportStates(prev => ({
        ...prev,
        [type]: { loading: false, result: null, error: 'Network error during import' },
      }))
    }
  }

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (loading) {
    return <LoadingState message="Checking HubSpot connection..." size="lg" />
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

      <div>
        <h1 className="text-3xl font-bold text-foreground">HubSpot Integration</h1>
        <p className="text-muted-foreground">
          Sync deal stages between Lotus and HubSpot CRM
        </p>
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
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: '#FFF0EB' }}
                >
                  <CheckCircle className="h-5 w-5" style={{ color: '#FF7A59' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: '#FF7A59' }}>Connected</span>
                    <Badge
                      className="border"
                      style={{ backgroundColor: '#FFF0EB', color: '#FF7A59', borderColor: '#FFD4C8' }}
                    >
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    HubSpot access token is configured
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-4 bg-muted/30">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Portal ID</p>
                  <p className="text-sm font-mono mt-1">{status.portalId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Sync</p>
                  <p className="text-sm mt-1">{formatLastSync(status.lastSyncAt)}</p>
                </div>
              </div>
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
                    HubSpot access token is not configured
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-6">
                <p className="text-sm text-muted-foreground mb-3">
                  To connect HubSpot, add your access token to the server environment variables:
                </p>
                <div className="rounded-md bg-muted p-3 font-mono text-sm">
                  HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  You can generate a private app access token from your HubSpot account under
                  Settings &gt; Integrations &gt; Private Apps.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Sync (only when connected) */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Manual Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Deals are synced automatically when status changes occur in Lotus.
                Use manual sync to catch up any missed updates.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  className="text-white font-semibold"
                  style={{ backgroundColor: '#FF7A59' }}
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Deal Stages
                </Button>
                {syncResult && (
                  <span className={`text-sm ${syncResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {syncResult.message}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import from HubSpot (only when connected) */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5" style={{ color: '#FF7A59' }} />
              <CardTitle className="text-lg">Import from HubSpot</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {/* Warning banner */}
              <div
                className="flex items-start gap-3 rounded-lg border p-4"
                style={{ backgroundColor: '#FFF8F0', borderColor: '#FFD4C8' }}
              >
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#FF7A59' }} />
                <p className="text-sm" style={{ color: '#7A3B2E' }}>
                  This will create or update records in Lotus based on your HubSpot data.
                  Existing records matched by HubSpot ID or email will be updated without overwriting non-empty fields.
                </p>
              </div>

              {/* Import buttons */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Import Contacts */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 font-semibold border-2 hover:border-[#FF7A59] hover:text-[#FF7A59]"
                    onClick={() => handleImport('contacts')}
                    disabled={importStates.contacts.loading}
                  >
                    {importStates.contacts.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                    Import Contacts
                  </Button>
                  {importStates.contacts.result && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs space-y-1">
                      <p className="font-medium text-green-800">
                        {importStates.contacts.result.imported} imported,{' '}
                        {importStates.contacts.result.updated ?? 0} updated
                      </p>
                      {importStates.contacts.result.skipped > 0 && (
                        <p className="text-green-700">
                          {importStates.contacts.result.skipped} skipped
                        </p>
                      )}
                      {importStates.contacts.result.errors.length > 0 && (
                        <p className="text-amber-700">
                          {importStates.contacts.result.errors.length} errors
                        </p>
                      )}
                    </div>
                  )}
                  {importStates.contacts.error && (
                    <p className="text-xs text-red-600">{importStates.contacts.error}</p>
                  )}
                </div>

                {/* Import Companies */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 font-semibold border-2 hover:border-[#FF7A59] hover:text-[#FF7A59]"
                    onClick={() => handleImport('companies')}
                    disabled={importStates.companies.loading}
                  >
                    {importStates.companies.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    Import Companies
                  </Button>
                  {importStates.companies.result && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs space-y-1">
                      <p className="font-medium text-green-800">
                        {importStates.companies.result.imported} imported,{' '}
                        {importStates.companies.result.updated ?? 0} updated
                      </p>
                      {importStates.companies.result.skipped > 0 && (
                        <p className="text-green-700">
                          {importStates.companies.result.skipped} skipped
                        </p>
                      )}
                      {importStates.companies.result.errors.length > 0 && (
                        <p className="text-amber-700">
                          {importStates.companies.result.errors.length} errors
                        </p>
                      )}
                    </div>
                  )}
                  {importStates.companies.error && (
                    <p className="text-xs text-red-600">{importStates.companies.error}</p>
                  )}
                </div>

                {/* Import Deals */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 font-semibold border-2 hover:border-[#FF7A59] hover:text-[#FF7A59]"
                    onClick={() => handleImport('deals')}
                    disabled={importStates.deals.loading}
                  >
                    {importStates.deals.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Handshake className="h-4 w-4" />
                    )}
                    Import Deals
                  </Button>
                  {importStates.deals.result && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs space-y-1">
                      <p className="font-medium text-green-800">
                        {importStates.deals.result.imported} imported as requests
                      </p>
                      {importStates.deals.result.skipped > 0 && (
                        <p className="text-green-700">
                          {importStates.deals.result.skipped} skipped (already imported)
                        </p>
                      )}
                      {importStates.deals.result.errors.length > 0 && (
                        <p className="text-amber-700">
                          {importStates.deals.result.errors.length} errors
                        </p>
                      )}
                    </div>
                  )}
                  {importStates.deals.error && (
                    <p className="text-xs text-red-600">{importStates.deals.error}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Sync Triggers Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Zap className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#FF7A59' }} />
            <div className="space-y-3 text-sm">
              <p className="font-medium text-foreground">Automatic Deal Stage Sync</p>
              <p className="text-muted-foreground">
                When these events happen in Lotus, the corresponding HubSpot deal stage is updated automatically:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="shrink-0 text-xs">PO Verified</Badge>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span>Deal moves to <strong className="text-foreground">PO Received</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="shrink-0 text-xs">PO Delivered / POD Confirmed</Badge>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span>Deal moves to <strong className="text-foreground">Closed Won, To Be Invoiced</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="shrink-0 text-xs">Client Invoice Paid</Badge>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span>Deal moves to <strong className="text-foreground">Closed Won</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="shrink-0 text-xs">Quote Rejected</Badge>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span>Deal moves to <strong className="text-foreground">Closed Lost</strong></span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Deals are synced automatically when status changes occur. Use manual sync to catch up
              any missed updates, for example after a server restart or if the HubSpot API was
              temporarily unavailable.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
