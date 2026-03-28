'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  ShoppingCart,
  Package,
  PackageCheck,
  Truck,
  CreditCard,
  ClipboardList,
  BarChart3,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Star,
  FileCheck,
  GitCompare,
  CheckSquare,
  AlertTriangle,
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

const navigationItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'MANAGER', 'SALES', 'PROCUREMENT', 'OPERATIONS'],
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Users,
    roles: ['ADMIN', 'MANAGER', 'SALES'],
  },
  {
    label: 'Requests',
    href: '/requests',
    icon: FileText,
    roles: ['ADMIN', 'MANAGER', 'SALES'],
  },
  {
    label: 'Quotes',
    href: '/quotes',
    icon: Receipt,
    roles: ['ADMIN', 'MANAGER', 'SALES'],
  },
  {
    label: 'Purchase Orders',
    href: '/orders',
    icon: ShoppingCart,
    roles: ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'],
  },
  {
    label: 'Receiving',
    href: '/receiving',
    icon: PackageCheck,
    roles: ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'],
  },
  {
    label: 'Procurement',
    href: '/procurement',
    icon: Package,
    roles: ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'],
  },
  {
    label: 'Delivery',
    href: '/delivery',
    icon: Truck,
    roles: ['ADMIN', 'MANAGER', 'OPERATIONS'],
  },
  {
    label: 'Billing',
    href: '/billing',
    icon: CreditCard,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Order Tracker',
    href: '/tracker',
    icon: ClipboardList,
    roles: ['ADMIN', 'MANAGER', 'OPERATIONS', 'PROCUREMENT'],
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: PieChart,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Suppliers',
    href: '/suppliers',
    icon: Star,
    roles: ['ADMIN', 'MANAGER', 'PROCUREMENT'],
  },
  {
    label: 'Invoices',
    href: '/invoices',
    icon: FileCheck,
    roles: ['ADMIN', 'MANAGER', 'PROCUREMENT'],
  },
  {
    label: 'Matching',
    href: '/matching',
    icon: GitCompare,
    roles: ['ADMIN', 'MANAGER', 'PROCUREMENT'],
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: CheckSquare,
    roles: ['ADMIN', 'MANAGER', 'SALES', 'PROCUREMENT', 'OPERATIONS'],
  },
  {
    label: 'Discrepancies',
    href: '/discrepancies',
    icon: AlertTriangle,
    roles: ['ADMIN', 'MANAGER', 'PROCUREMENT', 'OPERATIONS'],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Alerts',
    href: '/alerts',
    icon: Bell,
    roles: ['ADMIN', 'MANAGER', 'SALES', 'PROCUREMENT', 'OPERATIONS'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['ADMIN', 'MANAGER'],
  },
]

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()

  const userRole = session?.user?.role || ''

  const filteredItems = navigationItems.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <div
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded lotus-gradient">
              <span className="text-sm font-bold text-white">L</span>
            </div>
            <span className="font-semibold text-foreground">Lotus Connect</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'sidebar-nav-item',
                isActive && 'active',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('h-4 w-4', collapsed && 'mx-0')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {!collapsed && session && (
        <div className="p-4 border-t">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-medium text-primary">
                {session.user.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {session.user.role.toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
