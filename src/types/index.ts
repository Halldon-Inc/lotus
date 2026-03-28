import type { Prisma } from '@prisma/client'

// User types
export type User = {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'PROCUREMENT' | 'OPERATIONS'
  avatar: string | null
  department: string | null
  phone: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type UserWithCounts = User & {
  _count: {
    assignedClients: number
    assignedRequests: number
    createdQuotes: number
  }
}

// Client types
export type Client = {
  id: string
  name: string
  type: 'SCHOOL' | 'GOVERNMENT' | 'HEALTHCARE' | 'NONPROFIT' | 'CORPORATE'
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  fiscalYearStart: Date | null
  spendingLimit: number | null
  hubspotId: string | null
  assignedRepId: string | null
  createdAt: Date
  updatedAt: Date
}

export type ClientWithRep = Client & {
  assignedRep: User | null
}

export type ClientWithStats = Client & {
  assignedRep: User | null
  _count: {
    requests: number
    quotes: number
    purchaseOrders: number
  }
  totalSpent: number
}

// Request types
export type Request = {
  id: string
  clientId: string
  assignedToId: string | null
  createdById: string
  subject: string
  description: string
  source: 'EMAIL' | 'MANUAL' | 'HUBSPOT'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'QUOTED' | 'CLOSED'
  createdAt: Date
  updatedAt: Date
}

export type RequestWithRelations = Request & {
  client: Client
  assignedTo: User | null
  createdBy: User
  quotes: Quote[]
}

// Quote types
export type Quote = {
  id: string
  requestId: string
  clientId: string
  createdById: string
  quoteNumber: string
  totalAmount: number
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  validUntil: Date | null
  sentAt: Date | null
  hubspotQuoteId: string | null
  createdAt: Date
  updatedAt: Date
}

export type QuoteLineItem = {
  id: string
  quoteId: string
  productName: string
  description: string | null
  specifications: any | null
  quantity: number
  unitPrice: number
  totalPrice: number
  sourceUrl: string | null
  vendorName: string | null
  createdAt: Date
  updatedAt: Date
}

export type QuoteWithLineItems = Quote & {
  client: Client
  createdBy: User
  lineItems: QuoteLineItem[]
}

// Purchase Order types
export type PurchaseOrder = {
  id: string
  quoteId: string
  clientId: string
  poNumber: string
  totalAmount: number
  status: 'RECEIVED' | 'VERIFIED' | 'IN_PURCHASING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'DELIVERED'
  receivedAt: Date
  verifiedById: string | null
  discrepancyNotes: string | null
  createdAt: Date
  updatedAt: Date
}

export type PurchaseOrderItem = {
  id: string
  purchaseOrderId: string
  quoteLineItemId: string | null
  quantity: number
  status: 'PENDING' | 'SOURCED' | 'PURCHASED' | 'SHIPPED' | 'RECEIVED' | 'MISSING' | 'CANCELLED'
  sourcedById: string | null
  sourcedAt: Date | null
  sourceUrl: string | null
  vendorName: string | null
  purchasedById: string | null
  purchasedAt: Date | null
  orderNumber: string | null
  expectedDeliveryDate: Date | null
  receivedAt: Date | null
  receivedQuantity: number
  trackingNumber: string | null
  confirmationScreenshot: string | null
  createdAt: Date
  updatedAt: Date
}

export type PurchaseOrderWithDetails = PurchaseOrder & {
  client: Client
  quote: QuoteWithLineItems
  verifiedBy: User | null
  items: (PurchaseOrderItem & {
    quoteLineItem: QuoteLineItem | null
    sourcedBy: User | null
    purchasedBy: User | null
  })[]
}

// Alert types
export type Alert = {
  id: string
  userId: string
  type: 'MISSING_ITEM' | 'OVERDUE' | 'ATTENTION_REQUIRED' | 'DEADLINE' | 'SYSTEM'
  title: string
  message: string
  relatedEntityType: string | null
  relatedEntityId: string | null
  isRead: boolean
  readAt: Date | null
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  createdAt: Date
  updatedAt: Date
}

export type AlertWithUser = Alert & {
  user: User
}

// Activity Log types
export type ActivityLog = {
  id: string
  userId: string
  entityType: string
  entityId: string
  action: string
  details: any | null
  createdAt: Date
}

export type ActivityLogWithUser = ActivityLog & {
  user: User
}

// Note types
export type Note = {
  id: string
  entityType: string
  entityId: string
  userId: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export type NoteWithUser = Note & {
  user: User
}

// Dashboard types
export type DashboardStats = {
  totalRequests: number
  totalQuotes: number
  totalPurchaseOrders: number
  totalRevenue: number
  openRequests: number
  pendingQuotes: number
  overdueItems: number
  recentActivity: ActivityLogWithUser[]
}

export type PipelineStats = {
  new: number
  assigned: number
  inProgress: number
  quoted: number
  closed: number
}

// Report types
export type ClientSpendingReport = {
  clientId: string
  clientName: string
  totalSpent: number
  orderCount: number
  averageOrderValue: number
  fiscalYearSpent: number
  spendingLimit: number | null
}

export type RepPerformanceReport = {
  userId: string
  userName: string
  totalOrders: number
  totalRevenue: number
  averageResolutionTime: number
  missingItemRate: number
  customerSatisfaction: number
}

// Invoice types
export type Invoice = {
  id: string
  invoiceNumber: string
  vendorName: string
  totalAmount: number
  status: 'PENDING' | 'PENDING_MATCH' | 'MATCHED' | 'PARTIAL_MATCH' | 'DISPUTED' | 'PAID'
  dueDate: Date | null
  receivedDate: Date | null
  fileUrl: string | null
  notes: string | null
  purchaseOrderId: string | null
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export type InvoiceLineItem = {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  createdAt: Date
  updatedAt: Date
}

export type InvoiceWithDetails = Invoice & {
  lineItems: InvoiceLineItem[]
  purchaseOrder: (PurchaseOrder & { client: Client }) | null
  createdBy: User
  matches: MatchRecord[]
}

// Matching types
export type MatchRecord = {
  id: string
  invoiceId: string
  purchaseOrderId: string
  status: 'AUTO_MATCHED' | 'PARTIAL_MATCH' | 'MISMATCH' | 'MANUAL_OVERRIDE'
  tolerancePercent: number
  totalVariance: number
  notes: string | null
  overrideById: string | null
  overrideAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type MatchLineComparison = {
  id: string
  matchRecordId: string
  description: string
  poQuantity: number | null
  poUnitPrice: number | null
  invoiceQuantity: number
  invoiceUnitPrice: number
  receivedQuantity: number | null
  quantityMatch: 'MATCH' | 'PARTIAL' | 'MISMATCH'
  priceMatch: 'MATCH' | 'PARTIAL' | 'MISMATCH'
}

export type MatchRecordWithDetails = MatchRecord & {
  invoice: Invoice
  purchaseOrder: PurchaseOrder & { client: Client }
  lineComparisons: MatchLineComparison[]
  overrideBy: User | null
}

// Approval types
export type ApprovalRule = {
  id: string
  name: string
  entityType: 'PURCHASE_ORDER' | 'INVOICE' | 'REQUEST'
  conditionField: string
  conditionOp: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  conditionValue: string
  approverRole: string | null
  approverUserId: string | null
  priority: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type ApprovalRequest = {
  id: string
  entityType: string
  entityId: string
  ruleId: string | null
  requestedById: string
  approverId: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED'
  requestedAt: Date
  resolvedAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type ApprovalRequestWithDetails = ApprovalRequest & {
  rule: ApprovalRule | null
  requestedBy: User
  approver: User | null
}

// Discrepancy types
export type Discrepancy = {
  id: string
  purchaseOrderId: string
  purchaseOrderItemId: string | null
  invoiceId: string | null
  type: 'QUANTITY_MISMATCH' | 'PRICE_MISMATCH' | 'WRONG_ITEM' | 'DAMAGED' | 'MISSING' | 'EXTRA'
  expectedValue: string
  actualValue: string
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'ESCALATED'
  reportedById: string
  resolvedById: string | null
  resolvedAt: Date | null
  resolutionNotes: string | null
  photoUrls: string | null
  createdAt: Date
  updatedAt: Date
}

export type DiscrepancyWithDetails = Discrepancy & {
  purchaseOrder: PurchaseOrder & { client: Client }
  purchaseOrderItem: (PurchaseOrderItem & { quoteLineItem: QuoteLineItem | null }) | null
  invoice: Invoice | null
  reportedBy: User
  resolvedBy: User | null
}

// API Response types
export type ApiResponse<T = any> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type PaginatedResponse<T = any> = ApiResponse<{
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}>

// Form types
export type CreateClientForm = {
  name: string
  type: Client['type']
  address?: string
  city?: string
  state?: string
  zip?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  fiscalYearStart?: string
  spendingLimit?: number
  assignedRepId?: string
}

export type CreateRequestForm = {
  clientId: string
  subject: string
  description: string
  priority: Request['priority']
  assignedToId?: string
}

export type CreateQuoteLineItemForm = {
  productName: string
  description?: string
  specifications?: any
  quantity: number
  unitPrice: number
  sourceUrl?: string
  vendorName?: string
}

export type CreateQuoteForm = {
  requestId: string
  clientId: string
  validUntil?: string
  lineItems: CreateQuoteLineItemForm[]
}

// Search types
export type SearchFilters = {
  query?: string
  type?: 'clients' | 'requests' | 'quotes' | 'orders'
  status?: string
  assignedTo?: string
  dateRange?: {
    from: Date
    to: Date
  }
}

export type SearchResult = {
  id: string
  type: 'client' | 'request' | 'quote' | 'order'
  title: string
  subtitle: string
  status?: string
  createdAt: Date
  url: string
}

// Utility types
export type SortDirection = 'asc' | 'desc'
export type PaginationOptions = {
  page: number
  pageSize: number
  sortBy?: string
  sortDirection?: SortDirection
}

export type TableColumn<T = any> = {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, row: T) => React.ReactNode
}

// Component prop types
export type StatusPillProps = {
  status: string
  variant?: 'default' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export type AgingIndicatorProps = {
  date: Date | string
  expectedDate?: Date | string
  showText?: boolean
}

export type DataTableProps<T = any> = {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  pagination?: PaginationOptions
  onPaginationChange?: (pagination: PaginationOptions) => void
  onRowClick?: (row: T) => void
  emptyMessage?: string
}
