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

  // Invoice statuses
  PENDING_MATCH: { label: 'Pending Match', className: 'bg-yellow-100 text-yellow-800' },
  MATCHED: { label: 'Matched', className: 'bg-green-100 text-green-800' },
  PARTIAL_MATCH: { label: 'Partial Match', className: 'bg-amber-100 text-amber-800' },
  DISPUTED: { label: 'Disputed', className: 'bg-red-100 text-red-800' },
  PAID: { label: 'Paid', className: 'bg-emerald-100 text-emerald-800' },

  // Match statuses
  MATCH: { label: 'Match', className: 'bg-green-100 text-green-800' },
  MISMATCH: { label: 'Mismatch', className: 'bg-red-100 text-red-800' },
  MANUAL_OVERRIDE: { label: 'Manual Override', className: 'bg-purple-100 text-purple-800' },

  // Approval statuses
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  ESCALATED: { label: 'Escalated', className: 'bg-purple-100 text-purple-800' },

  // Discrepancy statuses
  OPEN: { label: 'Open', className: 'bg-red-100 text-red-800' },
  INVESTIGATING: { label: 'Investigating', className: 'bg-yellow-100 text-yellow-800' },

  // Match algorithm statuses
  AUTO_MATCHED: { label: 'Auto Matched', className: 'bg-green-100 text-green-800' },

  // Shipment statuses
  PREPARING: { label: 'Preparing', className: 'bg-slate-100 text-slate-800' },
  READY: { label: 'Ready', className: 'bg-blue-100 text-blue-800' },
  IN_TRANSIT: { label: 'In Transit', className: 'bg-indigo-100 text-indigo-800' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-800' },

  // POD statuses
  NONE: { label: 'None', className: 'bg-gray-100 text-gray-600' },
  UPLOADED: { label: 'Uploaded', className: 'bg-blue-100 text-blue-800' },

  // PO rejection statuses
  NEEDS_CORRECTION: { label: 'Needs Correction', className: 'bg-orange-100 text-orange-800' },
  RESUBMITTED: { label: 'Resubmitted', className: 'bg-cyan-100 text-cyan-800' },

  // Client invoice statuses
  OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-800' },

  // Discrepancy resolution
  RESOLVED: { label: 'Resolved', className: 'bg-green-100 text-green-800' },

  // Carrier/Manual method badges
  CARRIER: { label: 'Carrier', className: 'bg-blue-100 text-blue-800' },
  MANUAL: { label: 'Manual', className: 'bg-gray-100 text-gray-800' },
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
