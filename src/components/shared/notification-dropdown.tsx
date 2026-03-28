'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Bell,
  Info,
  AlertTriangle,
  AlertOctagon,
  Check,
  Loader2,
} from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Alert, ApiResponse, PaginatedResponse } from '@/types'

interface NotificationDropdownProps {
  userId: string
}

const POLL_INTERVAL = 30_000
const MAX_DISPLAYED = 10

const severityConfig: Record<string, { icon: typeof Info; className: string }> = {
  INFO: { icon: Info, className: 'text-blue-500' },
  WARNING: { icon: AlertTriangle, className: 'text-amber-500' },
  CRITICAL: { icon: AlertOctagon, className: 'text-red-500' },
}

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/alerts?userId=${encodeURIComponent(userId)}&pageSize=${MAX_DISPLAYED}&sortBy=createdAt&sortDirection=desc`
      )
      if (response.ok) {
        const body: PaginatedResponse<Alert> = await response.json()
        const items = (body.data?.items || []) as Alert[]
        setAlerts(items)
        setUnreadCount(items.filter((a) => !a.isRead).length)
      }
    } catch {
      // Silently handle polling errors
    }
  }, [userId])

  useEffect(() => {
    fetchAlerts()
    intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAlerts])

  const markAsRead = async (alertId: string) => {
    try {
      const response = await fetch(`/api/v1/alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      })
      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, isRead: true, readAt: new Date() } : a))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch {
      // Silently handle
    }
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      const unreadAlerts = alerts.filter((a) => !a.isRead)
      await Promise.all(
        unreadAlerts.map((a) =>
          fetch(`/api/v1/alerts/${a.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRead: true }),
          })
        )
      )
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true, readAt: a.readAt || new Date() })))
      setUnreadCount(0)
    } catch {
      // Silently handle
    } finally {
      setMarkingAll(false)
    }
  }

  const handleAlertClick = (alert: Alert) => {
    if (!alert.isRead) {
      markAsRead(alert.id)
    }

    if (alert.relatedEntityType && alert.relatedEntityId) {
      const entityRoutes: Record<string, string> = {
        request: '/requests',
        quote: '/quotes',
        purchaseOrder: '/orders',
        client: '/clients',
      }
      const basePath = entityRoutes[alert.relatedEntityType]
      if (basePath) {
        router.push(`${basePath}/${alert.relatedEntityId}`)
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              Mark All Read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {/* Alert list */}
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            alerts.map((alert) => {
              const config = severityConfig[alert.severity] || severityConfig.INFO
              const SeverityIcon = config.icon

              return (
                <button
                  key={alert.id}
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex gap-3 items-start',
                    !alert.isRead && 'bg-primary/5'
                  )}
                  onClick={() => handleAlertClick(alert)}
                >
                  <SeverityIcon className={cn('h-4 w-4 mt-0.5 shrink-0', config.className)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm truncate', !alert.isRead && 'font-medium')}>
                        {alert.title}
                      </p>
                      {!alert.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(alert.createdAt)}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <DropdownMenuSeparator />
        <div className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/alerts')}
          >
            View All Notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
