import { cn } from '@/lib/utils'

interface StatusPillProps {
  status: string
  variant?: 'default' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig = {
  // Request statuses
  NEW: { label: 'New', className: 'status-new' },
  ASSIGNED: { label: 'Assigned', className: 'status-assigned' },
  IN_PROGRESS: { label: 'In Progress', className: 'status-in-progress' },
  QUOTED: { label: 'Quoted', className: 'status-quoted' },
  CLOSED: { label: 'Closed', className: 'status-closed' },

  // Quote statuses
  DRAFT: { label: 'Draft', className: 'status-draft' },
  SENT: { label: 'Sent', className: 'status-sent' },
  ACCEPTED: { label: 'Accepted', className: 'status-accepted' },
  REJECTED: { label: 'Rejected', className: 'status-rejected' },
  EXPIRED: { label: 'Expired', className: 'status-expired' },

  // Purchase Order statuses
  RECEIVED: { label: 'Received', className: 'status-received' },
  VERIFIED: { label: 'Verified', className: 'status-verified' },
  IN_PURCHASING: { label: 'In Purchasing', className: 'status-in-purchasing' },
  PARTIALLY_FULFILLED: { label: 'Partially Fulfilled', className: 'status-partially-fulfilled' },
  FULFILLED: { label: 'Fulfilled', className: 'status-fulfilled' },
  DELIVERED: { label: 'Delivered', className: 'status-delivered' },

  // Purchase Order Item statuses
  PENDING: { label: 'Pending', className: 'status-pending' },
  SOURCED: { label: 'Sourced', className: 'status-sourced' },
  PURCHASED: { label: 'Purchased', className: 'status-purchased' },
  SHIPPED: { label: 'Shipped', className: 'status-shipped' },
  MISSING: { label: 'Missing', className: 'status-missing' },
  CANCELLED: { label: 'Cancelled', className: 'status-cancelled' },
} as const

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export function StatusPill({ status, variant = 'default', size = 'md', className }: StatusPillProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    className: 'bg-gray-100 text-gray-800',
  }

  const baseClasses = 'status-pill inline-flex items-center rounded-full font-medium'
  const variantClasses = variant === 'outline' 
    ? 'border border-current bg-transparent' 
    : ''
  
  return (
    <span
      className={cn(
        baseClasses,
        config.className,
        sizeClasses[size],
        variantClasses,
        className
      )}
    >
      {config.label}
    </span>
  )
}
