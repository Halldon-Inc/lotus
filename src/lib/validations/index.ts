import { z } from 'zod'

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  role: z.enum(['ADMIN', 'MANAGER', 'SALES', 'PROCUREMENT', 'OPERATIONS']),
  department: z.string().optional(),
  phone: z.string().optional(),
})

export const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Client validation schemas
export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200, 'Name too long'),
  type: z.enum(['SCHOOL', 'GOVERNMENT', 'HEALTHCARE', 'NONPROFIT', 'CORPORATE']),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  fiscalYearStart: z.string().optional(),
  spendingLimit: z.number().positive('Spending limit must be positive').optional(),
  assignedRepId: z.string().optional(),
})

export const updateClientSchema = createClientSchema.partial()

// Request validation schemas
export const createRequestSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignedToId: z.string().optional(),
})

export const updateRequestSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long').optional(),
  description: z.string().min(1, 'Description is required').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'QUOTED', 'CLOSED']).optional(),
  assignedToId: z.string().optional(),
})

// Quote validation schemas
export const createQuoteLineItemSchema = z.object({
  productName: z.string().min(1, 'Product name is required').max(200, 'Product name too long'),
  description: z.string().optional(),
  specifications: z.any().optional(),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitPrice: z.number().positive('Unit price must be positive'),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  vendorName: z.string().optional(),
})

export const createQuoteSchema = z.object({
  requestId: z.string().min(1, 'Request is required'),
  clientId: z.string().min(1, 'Client is required'),
  validUntil: z.string().optional(),
  lineItems: z.array(createQuoteLineItemSchema).min(1, 'At least one line item is required'),
})

export const updateQuoteSchema = z.object({
  validUntil: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
  lineItems: z.array(createQuoteLineItemSchema.extend({ id: z.string().optional() })).optional(),
})

// Purchase Order validation schemas
export const createPurchaseOrderSchema = z.object({
  quoteId: z.string().min(1, 'Quote is required'),
  poNumber: z.string().min(1, 'PO number is required').max(100, 'PO number too long'),
  totalAmount: z.number().positive('Total amount must be positive'),
  discrepancyNotes: z.string().optional(),
})

export const updatePurchaseOrderSchema = z.object({
  status: z.enum(['RECEIVED', 'VERIFIED', 'NEEDS_CORRECTION', 'RESUBMITTED', 'IN_PURCHASING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'DELIVERED']).optional(),
  discrepancyNotes: z.string().optional(),
  verifiedById: z.string().optional(),
  rejectionReason: z.string().optional(),
  scheduledDeliveryDate: z.string().optional(),
  deliveryMethod: z.string().optional(),
})

// Purchase Order Item validation schemas
export const updatePurchaseOrderItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be a positive integer').optional(),
  status: z.enum(['PENDING', 'SOURCED', 'PURCHASED', 'SHIPPED', 'RECEIVED', 'MISSING', 'CANCELLED']).optional(),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  vendorName: z.string().optional(),
  orderNumber: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  receivedQuantity: z.number().int().min(0, 'Received quantity cannot be negative').optional(),
  trackingNumber: z.string().optional(),
  confirmationScreenshot: z.string().optional(),
})

// Alert validation schemas
export const createAlertSchema = z.object({
  userId: z.string().min(1, 'User is required'),
  type: z.enum(['MISSING_ITEM', 'OVERDUE', 'ATTENTION_REQUIRED', 'DEADLINE', 'SYSTEM']),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  message: z.string().min(1, 'Message is required'),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
})

export const updateAlertSchema = z.object({
  isRead: z.boolean().optional(),
})

// Note validation schemas
export const createNoteSchema = z.object({
  entityType: z.string().min(1, 'Entity type is required'),
  entityId: z.string().min(1, 'Entity ID is required'),
  content: z.string().min(1, 'Content is required'),
})

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Content is required'),
})

// Search validation schemas
export const searchSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['clients', 'requests', 'quotes', 'orders']).optional(),
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
})

// Pagination validation schema
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})

// API response validation schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

export const paginatedResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    items: z.array(z.any()),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  }).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

// Workflow validation schemas
export const workflowTransitionSchema = z.object({
  entityType: z.enum(['request', 'quote', 'purchaseOrder', 'purchaseOrderItem']),
  entityId: z.string().min(1, 'Entity ID is required'),
  newStatus: z.string().min(1, 'New status is required'),
  requiredFields: z.record(z.string(), z.any()).optional(),
  notes: z.string().optional(),
})

// File upload validation schema
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  size: z.number().positive('File size must be positive'),
})

// Settings validation schemas
export const settingsSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1, 'Key is required'),
    value: z.string().min(1, 'Value is required'),
  })).min(1, 'At least one setting is required'),
})

// Receiving validation schemas
export const receivingSearchSchema = z.object({
  q: z.string().min(1, 'Search term is required'),
})

export const receivingConfirmItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  receivedQuantity: z.number().int().min(0, 'Received quantity cannot be negative'),
  notes: z.string().optional(),
})

export const receivingConfirmSchema = z.object({
  items: z.array(receivingConfirmItemSchema).min(1, 'At least one item is required'),
})

// Invoice validation schemas
export const createInvoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitPrice: z.number().positive('Unit price must be positive'),
  totalPrice: z.number().positive('Total price must be positive'),
})

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(100, 'Invoice number too long'),
  vendorName: z.string().min(1, 'Vendor name is required').max(200, 'Vendor name too long'),
  totalAmount: z.number().positive('Total amount must be positive'),
  dueDate: z.string().optional(),
  fileUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  purchaseOrderId: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(createInvoiceLineItemSchema).min(1, 'At least one line item is required'),
})

export const updateInvoiceSchema = z.object({
  status: z.enum(['PENDING', 'MATCHED', 'PARTIAL', 'DISPUTED', 'PAID']).optional(),
  vendorName: z.string().min(1, 'Vendor name is required').max(200, 'Vendor name too long').optional(),
  dueDate: z.string().optional(),
  fileUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  purchaseOrderId: z.string().optional(),
  notes: z.string().optional(),
})

// Matching validation schemas
export const createMatchSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  tolerancePercent: z.number().min(0, 'Tolerance cannot be negative').max(100, 'Tolerance cannot exceed 100').default(5),
})

export const updateMatchSchema = z.object({
  status: z.enum(['AUTO_MATCHED', 'PARTIAL_MATCH', 'MISMATCH', 'MANUAL_OVERRIDE']),
  notes: z.string().min(1, 'Notes are required for manual override'),
})

// Approval validation schemas
export const createApprovalRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(200, 'Name too long'),
  entityType: z.enum(['PURCHASE_ORDER', 'INVOICE', 'REQUEST']),
  conditionField: z.string().min(1, 'Condition field is required'),
  conditionOp: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  conditionValue: z.string().min(1, 'Condition value is required'),
  approverRole: z.string().optional(),
  approverUserId: z.string().optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const updateApprovalRuleSchema = createApprovalRuleSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const createApprovalRequestSchema = z.object({
  entityType: z.string().min(1, 'Entity type is required'),
  entityId: z.string().min(1, 'Entity ID is required'),
  ruleId: z.string().optional(),
  notes: z.string().optional(),
})

export const resolveApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'ESCALATED']),
  notes: z.string().optional(),
})

// Discrepancy validation schemas
export const createDiscrepancySchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order is required'),
  purchaseOrderItemId: z.string().optional(),
  invoiceId: z.string().optional(),
  type: z.enum(['QUANTITY_MISMATCH', 'PRICE_MISMATCH', 'WRONG_ITEM', 'DAMAGED', 'MISSING', 'EXTRA']),
  expectedValue: z.string().min(1, 'Expected value is required'),
  actualValue: z.string().min(1, 'Actual value is required'),
  photoUrls: z.array(z.string().url('Invalid photo URL')).optional(),
})

export const updateDiscrepancySchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED']).optional(),
  resolutionNotes: z.string().optional(),
  photoUrls: z.array(z.string().url('Invalid photo URL')).optional(),
})

// Shipment validation schemas
export const createShipmentItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1, 'PO item ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  boxNumber: z.number().int().positive('Box number must be positive').optional(),
})

export const createShipmentSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order is required'),
  method: z.enum(['CARRIER', 'MANUAL']),
  carrierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(createShipmentItemSchema).min(1, 'At least one item is required'),
})

export const updateShipmentSchema = z.object({
  status: z.enum(['PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'INVESTIGATING']).optional(),
  carrierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
})

export const uploadPodSchema = z.object({
  podFileUrl: z.string().url('Invalid POD file URL'),
  deliveredAt: z.string().optional(),
})

// Client invoice validation schemas
export const createClientInvoiceSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order is required'),
  shipmentId: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export const updateClientInvoiceSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  podVerified: z.boolean().optional(),
})

// Utility validation functions
export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success
}

export function validateUrl(url: string): boolean {
  return z.string().url().safeParse(url).success
}

export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
}

export function validateRequired<T>(value: T, fieldName: string): T {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${fieldName} is required`)
  }
  return value
}

// Type inference helpers
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type CreateRequestInput = z.infer<typeof createRequestSchema>
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>
export type CreateQuoteLineItemInput = z.infer<typeof createQuoteLineItemSchema>
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>
export type UpdatePurchaseOrderItemInput = z.infer<typeof updatePurchaseOrderItemSchema>
export type CreateAlertInput = z.infer<typeof createAlertSchema>
export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type SearchInput = z.infer<typeof searchSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type SettingsInput = z.infer<typeof settingsSchema>
export type ReceivingSearchInput = z.infer<typeof receivingSearchSchema>
export type ReceivingConfirmInput = z.infer<typeof receivingConfirmSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type CreateInvoiceLineItemInput = z.infer<typeof createInvoiceLineItemSchema>
export type CreateMatchInput = z.infer<typeof createMatchSchema>
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>
export type CreateApprovalRuleInput = z.infer<typeof createApprovalRuleSchema>
export type UpdateApprovalRuleInput = z.infer<typeof updateApprovalRuleSchema>
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>
export type ResolveApprovalInput = z.infer<typeof resolveApprovalSchema>
export type CreateDiscrepancyInput = z.infer<typeof createDiscrepancySchema>
export type UpdateDiscrepancyInput = z.infer<typeof updateDiscrepancySchema>
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>
export type UploadPodInput = z.infer<typeof uploadPodSchema>
export type CreateClientInvoiceInput = z.infer<typeof createClientInvoiceSchema>
export type UpdateClientInvoiceInput = z.infer<typeof updateClientInvoiceSchema>
