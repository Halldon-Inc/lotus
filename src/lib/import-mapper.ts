interface FieldDefinition {
  key: string
  label: string
  required: boolean
  type: 'string' | 'number' | 'date' | 'email'
}

interface ValidationError {
  field: string
  message: string
}

type EntityType = 'clients' | 'inventory' | 'requests' | 'purchase-orders'

const ENTITY_FIELDS: Record<EntityType, FieldDefinition[]> = {
  clients: [
    { key: 'name', label: 'Client Name', required: true, type: 'string' },
    { key: 'type', label: 'Type', required: false, type: 'string' },
    { key: 'contactName', label: 'Contact Name', required: false, type: 'string' },
    { key: 'contactEmail', label: 'Contact Email', required: false, type: 'email' },
    { key: 'contactPhone', label: 'Contact Phone', required: false, type: 'string' },
    { key: 'address', label: 'Address', required: false, type: 'string' },
    { key: 'city', label: 'City', required: false, type: 'string' },
    { key: 'state', label: 'State', required: false, type: 'string' },
    { key: 'zip', label: 'Zip', required: false, type: 'string' },
    { key: 'spendingLimit', label: 'Spending Limit', required: false, type: 'number' },
    { key: 'fiscalYearStart', label: 'Fiscal Year Start', required: false, type: 'date' },
  ],
  inventory: [
    { key: 'name', label: 'Item Name', required: true, type: 'string' },
    { key: 'sku', label: 'SKU', required: false, type: 'string' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
    { key: 'category', label: 'Category', required: false, type: 'string' },
    { key: 'quantityOnHand', label: 'Quantity On Hand', required: false, type: 'number' },
    { key: 'reorderPoint', label: 'Reorder Point', required: false, type: 'number' },
    { key: 'location', label: 'Location', required: false, type: 'string' },
    { key: 'unitCost', label: 'Unit Cost', required: false, type: 'number' },
  ],
  requests: [
    { key: 'clientName', label: 'Client Name', required: true, type: 'string' },
    { key: 'subject', label: 'Subject', required: true, type: 'string' },
    { key: 'description', label: 'Description', required: false, type: 'string' },
    { key: 'priority', label: 'Priority', required: false, type: 'string' },
    { key: 'source', label: 'Source', required: false, type: 'string' },
  ],
  'purchase-orders': [
    { key: 'clientName', label: 'Client Name', required: true, type: 'string' },
    { key: 'poNumber', label: 'PO Number', required: true, type: 'string' },
    { key: 'totalAmount', label: 'Total Amount', required: false, type: 'number' },
    { key: 'deliveryMethod', label: 'Delivery Method', required: false, type: 'string' },
    { key: 'notes', label: 'Notes', required: false, type: 'string' },
  ],
}

const VALID_CLIENT_TYPES = ['SCHOOL', 'GOVERNMENT', 'HEALTHCARE', 'NONPROFIT', 'CORPORATE']
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const VALID_SOURCES = ['EMAIL', 'MANUAL', 'HUBSPOT']
const VALID_DELIVERY_METHODS = ['CARRIER', 'MANUAL']

export function getFieldsForEntity(entityType: string): FieldDefinition[] {
  const fields = ENTITY_FIELDS[entityType as EntityType]
  if (!fields) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }
  return fields
}

export function getEntityTypes(): EntityType[] {
  return Object.keys(ENTITY_FIELDS) as EntityType[]
}

export function applyMapping(
  row: Record<string, string>,
  columnMapping: Record<string, string>
): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [csvHeader, entityField] of Object.entries(columnMapping)) {
    if (entityField && row[csvHeader] !== undefined) {
      mapped[entityField] = row[csvHeader]
    }
  }
  return mapped
}

export function validateRow(
  entityType: string,
  row: Record<string, string>
): ValidationError[] {
  const fields = getFieldsForEntity(entityType)
  const errors: ValidationError[] = []

  for (const field of fields) {
    const value = row[field.key]

    if (field.required && (!value || !value.trim())) {
      errors.push({ field: field.key, message: `${field.label} is required` })
      continue
    }

    if (!value || !value.trim()) continue

    switch (field.type) {
      case 'number': {
        const num = Number(value)
        if (isNaN(num)) {
          errors.push({ field: field.key, message: `${field.label} must be a number` })
        }
        break
      }
      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          errors.push({ field: field.key, message: `${field.label} must be a valid email` })
        }
        break
      }
      case 'date': {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          errors.push({ field: field.key, message: `${field.label} must be a valid date` })
        }
        break
      }
    }
  }

  if (entityType === 'clients' && row.type) {
    const upper = row.type.toUpperCase()
    if (!VALID_CLIENT_TYPES.includes(upper)) {
      errors.push({
        field: 'type',
        message: `Type must be one of: ${VALID_CLIENT_TYPES.join(', ')}`,
      })
    }
  }

  if (entityType === 'requests' && row.priority) {
    const upper = row.priority.toUpperCase()
    if (!VALID_PRIORITIES.includes(upper)) {
      errors.push({
        field: 'priority',
        message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
      })
    }
  }

  if (entityType === 'requests' && row.source) {
    const upper = row.source.toUpperCase()
    if (!VALID_SOURCES.includes(upper)) {
      errors.push({
        field: 'source',
        message: `Source must be one of: ${VALID_SOURCES.join(', ')}`,
      })
    }
  }

  if (entityType === 'purchase-orders' && row.deliveryMethod) {
    const upper = row.deliveryMethod.toUpperCase()
    if (!VALID_DELIVERY_METHODS.includes(upper)) {
      errors.push({
        field: 'deliveryMethod',
        message: `Delivery method must be one of: ${VALID_DELIVERY_METHODS.join(', ')}`,
      })
    }
  }

  return errors
}

interface TransformedClientRow {
  name: string
  type: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  spendingLimit?: number
  fiscalYearStart?: Date
}

interface TransformedInventoryRow {
  name: string
  sku?: string
  description?: string
  category?: string
  quantityOnHand: number
  reorderPoint: number
  location?: string
  unitCost?: number
}

interface TransformedRequestRow {
  clientName: string
  subject: string
  description: string
  priority: string
  source: string
}

interface TransformedPurchaseOrderRow {
  clientName: string
  poNumber: string
  totalAmount: number
  deliveryMethod?: string
  notes?: string
}

export type TransformedRow =
  | TransformedClientRow
  | TransformedInventoryRow
  | TransformedRequestRow
  | TransformedPurchaseOrderRow

export function transformRow(
  entityType: string,
  row: Record<string, string>
): TransformedRow {
  switch (entityType) {
    case 'clients':
      return transformClientRow(row)
    case 'inventory':
      return transformInventoryRow(row)
    case 'requests':
      return transformRequestRow(row)
    case 'purchase-orders':
      return transformPurchaseOrderRow(row)
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}

function transformClientRow(row: Record<string, string>): TransformedClientRow {
  const result: TransformedClientRow = {
    name: row.name,
    type: row.type ? row.type.toUpperCase() : 'CORPORATE',
  }
  if (row.contactName) result.contactName = row.contactName
  if (row.contactEmail) result.contactEmail = row.contactEmail
  if (row.contactPhone) result.contactPhone = row.contactPhone
  if (row.address) result.address = row.address
  if (row.city) result.city = row.city
  if (row.state) result.state = row.state
  if (row.zip) result.zip = row.zip
  if (row.spendingLimit) result.spendingLimit = Number(row.spendingLimit)
  if (row.fiscalYearStart) result.fiscalYearStart = new Date(row.fiscalYearStart)
  return result
}

function transformInventoryRow(row: Record<string, string>): TransformedInventoryRow {
  const result: TransformedInventoryRow = {
    name: row.name,
    quantityOnHand: row.quantityOnHand ? parseInt(row.quantityOnHand, 10) : 0,
    reorderPoint: row.reorderPoint ? parseInt(row.reorderPoint, 10) : 0,
  }
  if (row.sku) result.sku = row.sku
  if (row.description) result.description = row.description
  if (row.category) result.category = row.category
  if (row.location) result.location = row.location
  if (row.unitCost) result.unitCost = Number(row.unitCost)
  return result
}

function transformRequestRow(row: Record<string, string>): TransformedRequestRow {
  return {
    clientName: row.clientName,
    subject: row.subject,
    description: row.description || '',
    priority: row.priority ? row.priority.toUpperCase() : 'MEDIUM',
    source: row.source ? row.source.toUpperCase() : 'MANUAL',
  }
}

function transformPurchaseOrderRow(row: Record<string, string>): TransformedPurchaseOrderRow {
  const result: TransformedPurchaseOrderRow = {
    clientName: row.clientName,
    poNumber: row.poNumber,
    totalAmount: row.totalAmount ? Number(row.totalAmount) : 0,
  }
  if (row.deliveryMethod) result.deliveryMethod = row.deliveryMethod.toUpperCase()
  if (row.notes) result.notes = row.notes
  return result
}

export function getTemplateHeaders(entityType: string): string[] {
  const fields = getFieldsForEntity(entityType)
  return fields.map((f) => f.label)
}

export function getTemplateCSV(entityType: string): string {
  const fields = getFieldsForEntity(entityType)
  return fields.map((f) => f.label).join(',')
}
