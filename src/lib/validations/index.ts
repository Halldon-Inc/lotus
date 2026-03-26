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
  status: z.enum(['RECEIVED', 'VERIFIED', 'IN_PURCHASING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'DELIVERED']).optional(),
  discrepancyNotes: z.string().optional(),
  verifiedById: z.string().optional(),
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
