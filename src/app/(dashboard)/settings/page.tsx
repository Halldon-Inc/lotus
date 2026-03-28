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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Settings,
  Users,
  UserPlus,
  Edit,
  Trash2,
  Shield,
  Bell,
  Database,
  Workflow,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  department: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface SystemSettings {
  alertThresholds: {
    overdueDays: number
    criticalMissingItems: number
    spendingLimitWarning: number
  }
  workflowConfig: {
    requireApprovalForOrders: boolean
    autoAssignRequests: boolean
    sendEmailNotifications: boolean
  }
  integrationSettings: {
    hubspotEnabled: boolean
    emailIntegrationEnabled: boolean
  }
}

const USER_ROLES = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SALES', label: 'Sales Rep' },
  { value: 'PROCUREMENT', label: 'Procurement' },
  { value: 'OPERATIONS', label: 'Operations' },
]

const DEPARTMENTS = [
  { value: 'SALES', label: 'Sales' },
  { value: 'PROCUREMENT', label: 'Procurement' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'MANAGEMENT', label: 'Management' },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    alertThresholds: {
      overdueDays: 7,
      criticalMissingItems: 3,
      spendingLimitWarning: 80,
    },
    workflowConfig: {
      requireApprovalForOrders: true,
      autoAssignRequests: true,
      sendEmailNotifications: true,
    },
    integrationSettings: {
      hubspotEnabled: false,
      emailIntegrationEnabled: true,
    },
  })

  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [qbConnected, setQbConnected] = useState<boolean | null>(null)
  const [hsConnected, setHsConnected] = useState<boolean | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: '',
    department: '',
    phone: '',
    isActive: true,
  })

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/users')
      const result = await response.json()

      if (result.success && result.data) {
        setUsers(result.data.items)
      } else {
        console.error('Failed to fetch users:', result.error)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/v1/settings')
      const result = await response.json()

      if (result.success && result.data) {
        const settingsMap: Record<string, string> = {}
        for (const s of result.data as { key: string; value: string }[]) {
          settingsMap[s.key] = s.value
        }

        setSystemSettings({
          alertThresholds: {
            overdueDays: parseInt(settingsMap['alert.overdue_threshold_days'] || '7'),
            criticalMissingItems: parseInt(settingsMap['alert.missing_item_enabled'] === 'true' ? '3' : '0'),
            spendingLimitWarning: parseInt(settingsMap['alert.deadline_reminder_days'] || '80'),
          },
          workflowConfig: {
            requireApprovalForOrders: settingsMap['workflow.require_quote_approval'] === 'true',
            autoAssignRequests: settingsMap['workflow.auto_assign_requests'] === 'true',
            sendEmailNotifications: settingsMap['integration.email_notifications'] === 'true',
          },
          integrationSettings: {
            hubspotEnabled: settingsMap['integration.hubspot_enabled'] === 'true',
            emailIntegrationEnabled: settingsMap['integration.email_notifications'] === 'true',
          },
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const saveSettings = async (section: 'alerts' | 'workflow' | 'integrations') => {
    setSettingsSaving(true)
    setSettingsMessage(null)

    let settings: { key: string; value: string }[] = []

    if (section === 'alerts') {
      settings = [
        { key: 'alert.overdue_threshold_days', value: String(systemSettings.alertThresholds.overdueDays) },
        { key: 'alert.missing_item_enabled', value: String(systemSettings.alertThresholds.criticalMissingItems > 0) },
        { key: 'alert.deadline_reminder_days', value: String(systemSettings.alertThresholds.spendingLimitWarning) },
      ]
    } else if (section === 'workflow') {
      settings = [
        { key: 'workflow.require_quote_approval', value: String(systemSettings.workflowConfig.requireApprovalForOrders) },
        { key: 'workflow.auto_assign_requests', value: String(systemSettings.workflowConfig.autoAssignRequests) },
        { key: 'integration.email_notifications', value: String(systemSettings.workflowConfig.sendEmailNotifications) },
      ]
    } else if (section === 'integrations') {
      settings = [
        { key: 'integration.hubspot_enabled', value: String(systemSettings.integrationSettings.hubspotEnabled) },
        { key: 'integration.email_notifications', value: String(systemSettings.integrationSettings.emailIntegrationEnabled) },
      ]
    }

    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      const result = await response.json()
      if (result.success) {
        setSettingsMessage({ text: 'Settings saved successfully', type: 'success' })
      } else {
        setSettingsMessage({ text: result.error || 'Failed to save settings', type: 'error' })
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setSettingsMessage({ text: 'Error saving settings', type: 'error' })
    } finally {
      setSettingsSaving(false)
      setTimeout(() => setSettingsMessage(null), 3000)
    }
  }

  const fetchQbStatus = async () => {
    try {
      const response = await fetch('/api/v1/quickbooks/status')
      const result = await response.json()
      if (result.success && result.data) {
        setQbConnected(result.data.connected)
      }
    } catch {
      setQbConnected(false)
    }
  }

  const fetchHsStatus = async () => {
    try {
      const response = await fetch('/api/v1/hubspot/status')
      const result = await response.json()
      if (result.success && result.data) {
        setHsConnected(result.data.connected)
      }
    } catch {
      setHsConnected(false)
    }
  }

  useEffect(() => {
    if (session?.user.role && ['ADMIN', 'MANAGER'].includes(session.user.role)) {
      fetchUsers()
      fetchSettings()
      fetchQbStatus()
      fetchHsStatus()
    }
  }, [session])

  const openUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        email: user.email,
        name: user.name || '',
        role: user.role,
        department: user.department || '',
        phone: user.phone || '',
        isActive: user.isActive,
      })
    } else {
      setEditingUser(null)
      setFormData({
        email: '',
        name: '',
        role: '',
        department: '',
        phone: '',
        isActive: true,
      })
    }
    setUserDialogOpen(true)
  }

  const handleSaveUser = async () => {
    try {
      const method = editingUser ? 'PATCH' : 'POST'
      const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
        setUserDialogOpen(false)
        setEditingUser(null)
      } else {
        console.error('Failed to save user:', result.error)
        alert(result.error || 'Failed to save user')
      }
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Error saving user')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return
    }

    try {
      const response = await fetch(`/api/v1/users/${userId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
      } else {
        console.error('Failed to delete user:', result.error)
        alert(result.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
    }
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'ADMIN': 'bg-red-100 text-red-800',
      'MANAGER': 'bg-purple-100 text-purple-800',
      'SALES': 'bg-blue-100 text-blue-800',
      'PROCUREMENT': 'bg-green-100 text-green-800',
      'OPERATIONS': 'bg-yellow-100 text-yellow-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  if (!session?.user.role || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<Settings className="h-8 w-8 text-muted-foreground" />}
          title="Access Denied"
          description="You don't have permission to access settings. Only administrators can view this page."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage system configuration and user permissions
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('users')}
        >
          <Users className="mr-2 h-4 w-4" />
          User Management
        </Button>
        <Button
          variant={activeTab === 'alerts' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('alerts')}
        >
          <Bell className="mr-2 h-4 w-4" />
          Alert Settings
        </Button>
        <Button
          variant={activeTab === 'workflow' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('workflow')}
        >
          <Workflow className="mr-2 h-4 w-4" />
          Workflow
        </Button>
        <Button
          variant={activeTab === 'integrations' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('integrations')}
        >
          <Database className="mr-2 h-4 w-4" />
          Integrations
        </Button>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>User Management</CardTitle>
              <Button onClick={() => openUserDialog()} className="lotus-button">
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState message="Loading users..." />
            ) : users.length === 0 ? (
              <EmptyState
                icon={<Users className="h-8 w-8 text-muted-foreground" />}
                title="No users found"
                description="No users have been created yet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name || user.email}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          {user.phone && (
                            <div className="text-xs text-muted-foreground">{user.phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.department ? (
                          <Badge variant="outline">{user.department}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openUserDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {user.id !== session.user.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alert Settings Tab */}
      {activeTab === 'alerts' && (
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label htmlFor="overdueDays">Overdue Alert (days)</Label>
                <Input
                  id="overdueDays"
                  type="number"
                  value={systemSettings.alertThresholds.overdueDays}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    alertThresholds: {
                      ...systemSettings.alertThresholds,
                      overdueDays: parseInt(e.target.value) || 0,
                    },
                  })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Alert when items are overdue by this many days
                </p>
              </div>

              <div>
                <Label htmlFor="criticalMissingItems">Critical Missing Items</Label>
                <Input
                  id="criticalMissingItems"
                  type="number"
                  value={systemSettings.alertThresholds.criticalMissingItems}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    alertThresholds: {
                      ...systemSettings.alertThresholds,
                      criticalMissingItems: parseInt(e.target.value) || 0,
                    },
                  })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Alert when this many or more items are missing from an order
                </p>
              </div>

              <div>
                <Label htmlFor="spendingLimitWarning">Spending Limit Warning (%)</Label>
                <Input
                  id="spendingLimitWarning"
                  type="number"
                  min={0}
                  max={100}
                  value={systemSettings.alertThresholds.spendingLimitWarning}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    alertThresholds: {
                      ...systemSettings.alertThresholds,
                      spendingLimitWarning: parseInt(e.target.value) || 0,
                    },
                  })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Alert when client spending reaches this percentage of their limit
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <Button
                  className="lotus-button"
                  onClick={() => saveSettings('alerts')}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Saving...' : 'Save Alert Settings'}
                </Button>
                {settingsMessage && activeTab === 'alerts' && (
                  <span className={settingsMessage.type === 'success' ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                    {settingsMessage.text}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Settings Tab */}
      {activeTab === 'workflow' && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="requireApproval"
                  checked={systemSettings.workflowConfig.requireApprovalForOrders}
                  onCheckedChange={(checked) => setSystemSettings({
                    ...systemSettings,
                    workflowConfig: {
                      ...systemSettings.workflowConfig,
                      requireApprovalForOrders: checked,
                    },
                  })}
                />
                <Label htmlFor="requireApproval">Require approval for purchase orders</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="autoAssign"
                  checked={systemSettings.workflowConfig.autoAssignRequests}
                  onCheckedChange={(checked) => setSystemSettings({
                    ...systemSettings,
                    workflowConfig: {
                      ...systemSettings.workflowConfig,
                      autoAssignRequests: checked,
                    },
                  })}
                />
                <Label htmlFor="autoAssign">Auto-assign requests to sales reps</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="emailNotifications"
                  checked={systemSettings.workflowConfig.sendEmailNotifications}
                  onCheckedChange={(checked) => setSystemSettings({
                    ...systemSettings,
                    workflowConfig: {
                      ...systemSettings.workflowConfig,
                      sendEmailNotifications: checked,
                    },
                  })}
                />
                <Label htmlFor="emailNotifications">Send email notifications</Label>
              </div>

              <div className="flex items-center space-x-4">
                <Button
                  className="lotus-button"
                  onClick={() => saveSettings('workflow')}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Saving...' : 'Save Workflow Settings'}
                </Button>
                {settingsMessage && activeTab === 'workflow' && (
                  <span className={settingsMessage.type === 'success' ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                    {settingsMessage.text}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* QuickBooks Integration Card */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Link href="/settings/quickbooks" className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-white font-bold text-lg"
                    style={{ backgroundColor: '#2CA01C' }}
                  >
                    QB
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">QuickBooks Online</p>
                    <p className="text-sm text-muted-foreground">
                      Sync customers, bills, and invoices with QuickBooks
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {qbConnected === null ? (
                    <Badge variant="outline" className="text-muted-foreground">Checking...</Badge>
                  ) : qbConnected ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <XCircle className="mr-1 h-3 w-3" />
                      Not Connected
                    </Badge>
                  )}
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* HubSpot Integration Card */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Link href="/settings/hubspot" className="flex items-center justify-between p-6 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-lg text-white font-bold text-lg"
                    style={{ backgroundColor: '#FF7A59' }}
                  >
                    HS
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">HubSpot CRM</p>
                    <p className="text-sm text-muted-foreground">
                      Sync deal stages automatically with HubSpot
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hsConnected === null ? (
                    <Badge variant="outline" className="text-muted-foreground">Checking...</Badge>
                  ) : hsConnected ? (
                    <Badge
                      className="border"
                      style={{ backgroundColor: '#FFF0EB', color: '#FF7A59', borderColor: '#FFD4C8' }}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <XCircle className="mr-1 h-3 w-3" />
                      Not Connected
                    </Badge>
                  )}
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* Other Integration Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Other Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hubspotEnabled"
                    checked={systemSettings.integrationSettings.hubspotEnabled}
                    onCheckedChange={(checked) => setSystemSettings({
                      ...systemSettings,
                      integrationSettings: {
                        ...systemSettings.integrationSettings,
                        hubspotEnabled: checked,
                      },
                    })}
                  />
                  <Label htmlFor="hubspotEnabled">Enable HubSpot integration</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="emailIntegration"
                    checked={systemSettings.integrationSettings.emailIntegrationEnabled}
                    onCheckedChange={(checked) => setSystemSettings({
                      ...systemSettings,
                      integrationSettings: {
                        ...systemSettings.integrationSettings,
                        emailIntegrationEnabled: checked,
                      },
                    })}
                  />
                  <Label htmlFor="emailIntegration">Enable email integration</Label>
                </div>

                <div className="flex items-center space-x-4">
                  <Button
                    className="lotus-button"
                    onClick={() => saveSettings('integrations')}
                    disabled={settingsSaving}
                  >
                    {settingsSaving ? 'Saving...' : 'Save Integration Settings'}
                  </Button>
                  {settingsMessage && activeTab === 'integrations' && (
                    <span className={settingsMessage.type === 'success' ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                      {settingsMessage.text}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                disabled={!!editingUser}
              />
            </div>

            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
              />
              <Label htmlFor="isActive">User is active</Label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setUserDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveUser}
                className="lotus-button"
              >
                {editingUser ? 'Update' : 'Create'} User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
