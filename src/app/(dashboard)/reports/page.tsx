'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
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
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  Download,
  Calendar,
  Filter,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ReportData {
  reportType: string
  dateRange: {
    startDate: string
    endDate: string
  }
  generatedAt: string
  clientSpending?: Array<{
    clientId: string
    clientName: string
    clientType: string
    assignedRep: string
    totalSpent: number
    orderCount: number
    averageOrderValue: number
    spendingLimit: number | null
    utilizationRate: number | null
    isOverLimit: boolean
  }>
  repPerformance?: Array<{
    userId: string
    userName: string
    totalRequests: number
    completedRequests: number
    quotedRequests: number
    totalOrders: number
    totalRevenue: number
    averageOrderValue: number
    averageResolutionTime: number
    missingItemRate: number
    conversionRate: number
  }>
  pipelineAnalytics?: {
    statusBreakdown: Record<string, number>
    monthlyTrends: Array<{
      month: string
      requests: number
      quotes: number
      orders: number
    }>
  }
}

interface ReportResponse {
  success: boolean
  data?: ReportData
  error?: string
}

const REPORT_TYPES = [
  { value: 'client-spending', label: 'Client Spending Analysis' },
  { value: 'rep-performance', label: 'Rep Performance Metrics' },
  { value: 'pipeline-analytics', label: 'Pipeline Analytics' },
]

export default function ReportsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState('client-spending')
  const [startDate, setStartDate] = useState(() => {
    // Default to current fiscal year (April 1st)
    const now = new Date()
    const fiscalStart = new Date(now.getFullYear(), 3, 1) // April 1st
    if (now < fiscalStart) {
      fiscalStart.setFullYear(now.getFullYear() - 1)
    }
    return fiscalStart.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    // Default to end of current fiscal year (March 31st)
    const now = new Date()
    const fiscalEnd = new Date(now.getFullYear() + 1, 2, 31) // March 31st
    if (now < new Date(now.getFullYear(), 3, 1)) {
      fiscalEnd.setFullYear(now.getFullYear())
    }
    return fiscalEnd.toISOString().split('T')[0]
  })
  const [reportData, setReportData] = useState<ReportData | null>(null)

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        type: reportType,
        startDate,
        endDate,
      })

      const response = await fetch(`/api/v1/reports?${params}`)
      const result: ReportResponse = await response.json()

      if (result.success && result.data) {
        setReportData(result.data)
      } else {
        console.error('Failed to fetch report:', result.error)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user.role && ['ADMIN', 'MANAGER'].includes(session.user.role)) {
      fetchReport()
    }
  }, [reportType, session])

  const handleGenerateReport = () => {
    fetchReport()
  }

  const exportReport = () => {
    if (!reportData) return

    const dataStr = JSON.stringify(reportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${reportType}-${formatDate(new Date())}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  if (!session?.user.role || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
          title="Access Denied"
          description="You don't have permission to view reports. Contact your administrator for access."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">
            Analytics and insights for business performance
          </p>
        </div>
        {reportData && (
          <Button onClick={exportReport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </div>

      {/* Report Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerateReport} className="lotus-button w-full">
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {loading ? (
        <LoadingState message="Generating report..." />
      ) : reportData ? (
        <div className="space-y-6">
          {/* Report Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {REPORT_TYPES.find(t => t.value === reportData.reportType)?.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(reportData.dateRange.startDate)} - {formatDate(reportData.dateRange.endDate)}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Generated {formatDate(reportData.generatedAt)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Spending Report */}
          {reportData.clientSpending && (
            <Card>
              <CardHeader>
                <CardTitle>Client Spending Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assigned Rep</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Avg Order</TableHead>
                      <TableHead>Spending Limit</TableHead>
                      <TableHead>Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.clientSpending.map((client) => (
                      <TableRow key={client.clientId}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{client.clientType}</Badge>
                        </TableCell>
                        <TableCell>{client.assignedRep}</TableCell>
                        <TableCell>{client.orderCount}</TableCell>
                        <TableCell>{formatCurrency(client.totalSpent)}</TableCell>
                        <TableCell>{formatCurrency(client.averageOrderValue)}</TableCell>
                        <TableCell>
                          {client.spendingLimit 
                            ? formatCurrency(client.spendingLimit)
                            : 'No limit'
                          }
                        </TableCell>
                        <TableCell>
                          {client.utilizationRate !== null ? (
                            <div className="flex items-center space-x-2">
                              <div className={`text-sm font-medium ${
                                client.isOverLimit ? 'text-red-600' : 
                                client.utilizationRate > 80 ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {client.utilizationRate.toFixed(1)}%
                              </div>
                              {client.isOverLimit && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Rep Performance Report */}
          {reportData.repPerformance && (
            <Card>
              <CardHeader>
                <CardTitle>Rep Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead>Requests</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Conversion</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Avg Order</TableHead>
                      <TableHead>Resolution Time</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.repPerformance.map((rep) => (
                      <TableRow key={rep.userId}>
                        <TableCell className="font-medium">{rep.userName}</TableCell>
                        <TableCell>{rep.totalRequests}</TableCell>
                        <TableCell>{rep.completedRequests}</TableCell>
                        <TableCell>
                          <div className={`text-sm font-medium ${
                            rep.conversionRate >= 80 ? 'text-green-600' :
                            rep.conversionRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {rep.conversionRate.toFixed(1)}%
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(rep.totalRevenue)}</TableCell>
                        <TableCell>{formatCurrency(rep.averageOrderValue)}</TableCell>
                        <TableCell>{rep.averageResolutionTime} days</TableCell>
                        <TableCell>
                          <div className={`text-sm font-medium ${
                            rep.missingItemRate <= 5 ? 'text-green-600' :
                            rep.missingItemRate <= 10 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {rep.missingItemRate.toFixed(1)}%
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Pipeline Analytics Report */}
          {reportData.pipelineAnalytics && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(reportData.pipelineAnalytics.statusBreakdown).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {status.toLowerCase().replace('_', ' ')}
                        </span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Requests</TableHead>
                        <TableHead>Quotes</TableHead>
                        <TableHead>Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.pipelineAnalytics.monthlyTrends.slice(-6).map((trend) => (
                        <TableRow key={trend.month}>
                          <TableCell className="font-medium">{trend.month}</TableCell>
                          <TableCell>{trend.requests}</TableCell>
                          <TableCell>{trend.quotes}</TableCell>
                          <TableCell>{trend.orders}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
          title="No report generated"
          description="Select report parameters and click 'Generate Report' to view analytics."
        />
      )}
    </div>
  )
}
