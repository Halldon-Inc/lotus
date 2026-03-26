'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bell,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle,
  Trash2,
  Filter,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface Alert {
  id: string
  type: string
  title: string
  message: string
  relatedEntityType: string | null
  relatedEntityId: string | null
  isRead: boolean
  readAt: string | null
  severity: string
  createdAt: string
}

interface AlertsResponse {
  success: boolean
  data?: {
    items: Alert[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    unreadCount: number
  }
  error?: string
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Alerts' },
  { value: 'unread', label: 'Unread Only' },
  { value: 'read', label: 'Read Only' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'MISSING_ITEM', label: 'Missing Items' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'ATTENTION_REQUIRED', label: 'Attention Required' },
  { value: 'DEADLINE', label: 'Deadlines' },
  { value: 'SYSTEM', label: 'System' },
]

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
]

export default function AlertsPage() {
  const { data: session } = useSession()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [readFilter, setReadFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchAlerts = async (
    isRead: string = 'all',
    type: string = 'all',
    severity: string = 'all',
    page: number = 1
  ) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      })

      if (isRead !== 'all') {
        params.set('isRead', isRead === 'read' ? 'true' : 'false')
      }
      if (type !== 'all') {
        params.set('type', type)
      }
      if (severity !== 'all') {
        params.set('severity', severity)
      }

      const response = await fetch(`/api/v1/alerts?${params}`)
      const result: AlertsResponse = await response.json()

      if (result.success && result.data) {
        setAlerts(result.data.items)
        setTotalPages(result.data.totalPages)
        setCurrentPage(result.data.page)
        setUnreadCount(result.data.unreadCount)
      } else {
        console.error('Failed to fetch alerts:', result.error)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  useEffect(() => {
    fetchAlerts(readFilter, typeFilter, severityFilter, 1)
  }, [readFilter, typeFilter, severityFilter])

  const handlePageChange = (page: number) => {
    fetchAlerts(readFilter, typeFilter, severityFilter, page)
  }

  const markAsRead = async (alertId: string) => {
    try {
      const response = await fetch(`/api/v1/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        setAlerts(alerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, isRead: true, readAt: new Date().toISOString() }
            : alert
        ))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } else {
        console.error('Failed to mark alert as read:', result.error)
      }
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }

  const markAsUnread = async (alertId: string) => {
    try {
      const response = await fetch(`/api/v1/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: false }),
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        setAlerts(alerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, isRead: false, readAt: null }
            : alert
        ))
        setUnreadCount(prev => prev + 1)
      } else {
        console.error('Failed to mark alert as unread:', result.error)
      }
    } catch (error) {
      console.error('Error marking alert as unread:', error)
    }
  }

  const deleteAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/v1/alerts/${alertId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        const alert = alerts.find(a => a.id === alertId)
        setAlerts(alerts.filter(a => a.id !== alertId))
        if (alert && !alert.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      } else {
        console.error('Failed to delete alert:', result.error)
      }
    } catch (error) {
      console.error('Error deleting alert:', error)
    }
  }

  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, React.ReactNode> = {
      'INFO': <Info className="h-4 w-4 text-blue-500" />,
      'WARNING': <AlertTriangle className="h-4 w-4 text-yellow-500" />,
      'CRITICAL': <AlertCircle className="h-4 w-4 text-red-500" />,
    }
    return icons[severity] || <Info className="h-4 w-4 text-gray-500" />
  }

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      'INFO': 'bg-blue-100 text-blue-800',
      'WARNING': 'bg-yellow-100 text-yellow-800',
      'CRITICAL': 'bg-red-100 text-red-800',
    }
    return colors[severity] || 'bg-gray-100 text-gray-800'
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'MISSING_ITEM': 'Missing Item',
      'OVERDUE': 'Overdue',
      'ATTENTION_REQUIRED': 'Attention Required',
      'DEADLINE': 'Deadline',
      'SYSTEM': 'System',
    }
    return labels[type] || type
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alerts</h1>
          <p className="text-muted-foreground">
            Stay informed with important notifications and updates
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-sm">
            {unreadCount} unread
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold">{alerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold">{unreadCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold">
                  {alerts.filter(a => a.severity === 'WARNING').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold">
                  {alerts.filter(a => a.severity === 'CRITICAL').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by read status" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>All Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading alerts..." />
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-8 w-8 text-muted-foreground" />}
              title="No alerts found"
              description="You're all caught up! No alerts match your current filters."
            />
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.isRead 
                      ? 'bg-background border-border' 
                      : 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className={`font-medium ${alert.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {alert.title}
                          </h3>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">
                            {getTypeLabel(alert.type)}
                          </Badge>
                        </div>
                        <p className={`text-sm ${alert.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {alert.message}
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(alert.createdAt)}
                          </span>
                          {alert.isRead && alert.readAt && (
                            <span className="text-xs text-muted-foreground">
                              Read {formatRelativeTime(alert.readAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      {alert.isRead ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsUnread(alert.id)}
                          title="Mark as unread"
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(alert.id)}
                          title="Mark as read"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAlert(alert.id)}
                        title="Delete alert"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center pt-4 space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
