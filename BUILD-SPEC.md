# Lotus Connect Portal: Complete Build Specification

## Overview
Centralized procurement and order management portal for Lotus Connect, a government and educational procurement company. Replaces disconnected Google Sheets with a unified, workflow-enforced system covering the full lifecycle: request intake, quoting, PO processing, procurement, receiving, delivery, invoicing, and payment.

**Live**: lotus-fawn.vercel.app
**Repo**: github.com/Halldon-Inc/lotus

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui (Radix primitives)
- **Database**: SQLite via Prisma ORM (bundled for Vercel serverless)
- **Auth**: NextAuth.js v4 with JWT sessions and role-based access control
- **Validation**: Zod schemas + React Hook Form
- **Deployment**: Vercel (Turbopack build, SQLite copied to /tmp at runtime)
- **Integrations**: QuickBooks Online (OAuth 2.0), HubSpot (Private App), Resend (email), Detrack (CSV export)

## Design Direction

### Color Palette (Lotus Connect branding)
- **Primary**: Deep teal (#0D7377)
- **Accent**: Gold/amber (#D4A843)
- **Background**: Clean whites (#F8FAFB, #FFFFFF)
- **Surface**: Soft gray cards (#F1F5F9)
- **Text**: Dark charcoal (#1A1A2E) headings, (#4A5568) body
- **Status**: Green (#10B981), Amber (#F59E0B), Red (#EF4444), Blue (#3B82F6)

### Vibes (Halldon quality standard)
- Clean, modern, premium feel
- Generous whitespace, intentional spacing
- Smooth transitions and micro-interactions
- Dashboard as command center, not spreadsheet
- Cards with subtle shadows, rounded corners
- Professional but not corporate-boring

### UX (HubSpot familiarity)
- Left sidebar navigation (collapsible, role-filtered)
- Top bar with search, notification bell, user avatar
- Data tables with sorting, filtering, pagination
- Status pills with color coding (red/yellow/green aging)
- Slide-in detail panels on row click

## Database Schema (24 Models)

### Core Entities

#### Users
- id, email, name, role, avatar, department, phone, isActive
- Roles: ADMIN, MANAGER, SALES, PROCUREMENT, OPERATIONS

#### Clients
- id, name, type (SCHOOL/GOVERNMENT/HEALTHCARE/NONPROFIT/CORPORATE)
- address, city, state, zip, shippingAddress, shippingCity, shippingState, shippingZip
- contactName, contactEmail, contactPhone
- fiscalYearStart, spendingLimit
- hubspotId, quickbooksId, assignedRepId

#### Requests
- id, clientId, assignedToId, createdById
- subject, description, source (EMAIL/MANUAL/HUBSPOT)
- priority (LOW/MEDIUM/HIGH/URGENT)
- status (NEW/ASSIGNED/IN_PROGRESS/QUOTED/CLOSED)

#### Quotes
- id, requestId, clientId, createdById
- quoteNumber (auto-generated), totalAmount
- status (DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED)
- validUntil, sentAt, hubspotQuoteId

#### QuoteLineItems
- id, quoteId, productName, description, specifications (JSON)
- quantity, unitPrice, totalPrice, sourceUrl, vendorName

#### PurchaseOrders
- id, quoteId (optional, supports manual POs), clientId
- poNumber, totalAmount
- status: RECEIVED > VERIFIED > NEEDS_CORRECTION > RESUBMITTED > IN_PURCHASING > PARTIALLY_FULFILLED > FULFILLED > DELIVERED
- verifiedById, discrepancyNotes
- scheduledDeliveryDate, deliveryMethod
- rejectionReason, rejectionCount, notes

#### PurchaseOrderItems
- id, purchaseOrderId, quoteLineItemId
- quantity, status: PENDING > SOURCED > PURCHASED > SHIPPED > RECEIVED | MISSING | CANCELLED
- sourcedById, sourcedAt, sourceUrl, vendorName
- purchasedById, purchasedAt, orderNumber
- expectedDeliveryDate, receivedAt, receivedQuantity
- trackingNumber, confirmationScreenshot

### Finance Entities

#### Invoice (Vendor/AP)
- id, invoiceNumber, vendorName, totalAmount
- status (PENDING/MATCHED/PARTIAL/DISPUTED/PAID)
- receivedAt, dueDate, fileUrl, purchaseOrderId
- quickbooksId, notes

#### InvoiceLineItem
- id, invoiceId, description, quantity, unitPrice, totalPrice

#### MatchRecord (3-Way Matching)
- id, purchaseOrderId, invoiceId
- status (AUTO_MATCHED/PARTIAL_MATCH/MISMATCH/MANUAL_OVERRIDE)
- matchedAt, toleranceUsed, notes, details (JSON)

#### ClientInvoice (AR)
- id, purchaseOrderId, clientId, shipmentId
- invoiceNumber, totalAmount
- status (DRAFT/SENT/PAID/OVERDUE/CANCELLED)
- sentAt, paidAt, dueDate, podVerified
- quickbooksId, notes

### Workflow Entities

#### ApprovalRule
- id, name, entityType (PURCHASE_ORDER/INVOICE/REQUEST)
- conditionField, conditionOp (gt/lt/gte/lte/eq), conditionValue
- approverRole, approverUserId, priority, isActive

#### ApprovalRequest
- id, entityType, entityId, ruleId
- requestedById, approverId
- status (PENDING/APPROVED/REJECTED/ESCALATED)
- requestedAt, resolvedAt, notes

#### Discrepancy
- id, purchaseOrderId, purchaseOrderItemId, invoiceId
- type (QUANTITY_MISMATCH/PRICE_MISMATCH/WRONG_ITEM/DAMAGED/MISSING/EXTRA)
- expectedValue, actualValue
- status (OPEN/INVESTIGATING/RESOLVED/ESCALATED)
- reportedById, resolvedById, resolvedAt, resolutionNotes, photoUrls (JSON)

### Logistics Entities

#### Shipment
- id, purchaseOrderId
- method (CARRIER/MANUAL), carrierName, trackingNumber
- scheduledDate, shippedAt, deliveredAt
- podFileUrl, podStatus (NONE/UPLOADED/VERIFIED)
- status: PREPARING > READY > IN_TRANSIT > DELIVERED | FAILED | INVESTIGATING

#### ShipmentItem
- id, shipmentId, purchaseOrderItemId, quantity, boxNumber

### Inventory Entities

#### InventoryItem
- id, name, sku (unique), description, category
- quantityOnHand, quantityReserved, reorderPoint
- location, unitCost, lastRestockedAt

#### InventoryMovement
- id, inventoryItemId, type (RECEIVED/ALLOCATED/SHIPPED/RETURNED/ADJUSTMENT)
- quantity, referenceType, referenceId, notes, performedById

### System Entities

#### Alert
- id, userId, type (MISSING_ITEM/OVERDUE/ATTENTION_REQUIRED/DEADLINE/SYSTEM)
- title, message, relatedEntityType, relatedEntityId
- isRead, readAt, severity (INFO/WARNING/CRITICAL)

#### ActivityLog
- id, userId, entityType, entityId
- action (created/updated/status-changed/assigned/note-added), details (JSON)

#### Note
- id, entityType, entityId, userId, content

#### SystemSettings
- id, key (unique), value

#### QuickBooksConnection
- id, realmId, accessToken, refreshToken, tokenExpiresAt
- companyName, isActive, connectedAt, lastSyncAt, syncStatus

#### ImportSession
- id, userId, entityType, fileName, headers, data
- status (PENDING/COMPLETE/FAILED), results

## Implemented Features

### Authentication and Access Control
- Credentials-based login (NextAuth.js, JWT, 8-hour sessions)
- 5 roles: ADMIN, MANAGER, SALES, PROCUREMENT, OPERATIONS
- Middleware-enforced route protection and role-based access
- Settings/reports restricted to ADMIN + MANAGER
- Procurement restricted to ADMIN + MANAGER + PROCUREMENT + OPERATIONS

### Dashboard
- Command center with stats cards: clients, requests, quotes, POs, revenue
- Recent activity feed (last 20 actions)
- Overdue items counter
- Role-filtered views

### Client Management
- CRUD with paginated listing
- Client detail view with request/quote/PO history
- Client types: School, Government, Healthcare, Nonprofit, Corporate
- Fiscal year and spending limit tracking
- HubSpot ID and QuickBooks ID linkage

### Request Intake
- Create from email, manual entry, or HubSpot import
- Auto-assignment via round-robin (rep with fewest open requests)
- Manual assignment and reassignment
- Priority levels with visual indicators
- Status pipeline: NEW > ASSIGNED > IN_PROGRESS > QUOTED > CLOSED

### Quote Builder
- Create quotes with multiple line items (product, specs, pricing, vendor)
- Auto-generated quote numbers
- Status tracking: DRAFT > SENT > ACCEPTED > REJECTED > EXPIRED
- Total amount auto-calculated from line items
- Valid-until date and sent-at tracking

### Purchase Order Processing
- Two creation paths: from accepted quote OR manual entry
- PO validation with rejection workflow (NEEDS_CORRECTION > RESUBMITTED)
- Rejection reason tracking with counter
- Approval workflow integration (configurable rules)
- Line-item level tracking through sourcing, purchasing, shipping, receiving

### Procurement Workflow
- Inventory check: allocate from stock or purchase from vendors
- Per-item sourcing with vendor, URL, and confirmation screenshot
- Per-item purchasing with order number, date, and expected delivery
- Status enforcement: cannot advance without required fields

### 3-Way Matching (PO vs Invoice vs Received)
- Vendor invoice creation with line items
- Auto-match, partial match, and mismatch detection
- Tolerance-based matching with configurable thresholds
- Batch matching for bulk operations
- Manual override with audit trail

### Approval Engine
- Configurable approval rules based on entity type, field, and threshold
- Role-based and user-specific approver assignment
- Approval status tracking: PENDING > APPROVED / REJECTED / ESCALATED
- Priority ordering for rule evaluation

### Discrepancy Management
- 6 discrepancy types: quantity, price, wrong item, damaged, missing, extra
- Investigation workflow: OPEN > INVESTIGATING > RESOLVED / ESCALATED
- Reporter and resolver tracking with timestamps
- Photo documentation support (URL array)
- Linked to POs, PO items, and invoices

### Receiving Station
- Search by PO number, tracking number, or order number
- Item-by-item quantity verification
- Partial receipt logging with remaining item tracking
- Discrepancy creation when quantities don't match
- Receiving history with filters

### Shipment and Delivery
- Shipment creation with carrier or manual delivery method
- Carrier integration: tracking numbers, carrier names
- Manual delivery: CSV export to Detrack
- Packing slip generation per shipment
- Proof of delivery (POD) upload and verification
- Status pipeline: PREPARING > READY > IN_TRANSIT > DELIVERED

### Inventory Management
- Item catalog with SKU, category, location, unit cost
- Quantity tracking: on-hand, reserved, available
- Reorder point alerts (low stock detection)
- Movement history: received, allocated, shipped, returned, adjustments
- Stock allocation to purchase orders

### Client Invoicing (AR)
- Invoice generation from completed POs
- POD verification requirement before invoicing
- Status tracking: DRAFT > SENT > PAID > OVERDUE > CANCELLED
- Due date and overdue detection
- QuickBooks sync for invoice creation

### Analytics and Reporting
- Vendor spend breakdown
- Client spend breakdown
- Spend by category/type
- Monthly trend analysis
- Budget utilization tracking
- Supplier performance metrics

### Data Import Pipeline
- CSV upload with column mapping wizard
- Preview before import execution
- Template downloads for standardized imports
- HubSpot import: contacts, companies, deals
- QuickBooks import: customers, vendors, invoices

### Integrations

#### QuickBooks Online
- OAuth 2.0 connection flow (connect/disconnect)
- Customer sync (bidirectional)
- Invoice sync (create QB invoices from client invoices)
- Bill sync (vendor invoices to QB bills)
- Import: customers, vendors, invoices from QB
- Connection status monitoring

#### HubSpot
- Deal stage synchronization
- Contact, company, and deal import
- Connection status check
- Manual sync trigger

#### Email (Resend)
- Branded email templates: procurement alerts, PO corrections, delivery confirmations
- Configurable sender identity
- Test email endpoint for verification

#### Detrack
- CSV export for manual deliveries
- Formatted for Detrack import specifications

### Global Search
- Cross-entity search: clients, requests, quotes, POs
- Result type indicators
- Deep linking to entity detail pages

### Alert System
- In-app notification center
- Alert types: missing item, overdue, attention required, deadline, system
- Severity levels: info, warning, critical
- Read/unread tracking

## API Structure (70+ endpoints)
All routes under `/api/v1/`:

```
/auth/*                    Authentication (NextAuth.js)
/users, /users/[id]        User management
/clients, /clients/[id]    Client CRUD
/requests, /requests/[id]  Request intake and assignment
/quotes, /quotes/[id]      Quote builder with line items
/purchase-orders           PO management
/purchase-orders/[id]      PO detail and status updates
/purchase-order-items/[id] Item-level tracking
/invoices, /invoices/[id]  Vendor invoice management
/client-invoices           Client invoice generation
/client-invoices/[id]      Client invoice detail
/matching, /matching/[id]  3-way matching
/matching/batch            Bulk matching operations
/approvals                 Approval request management
/approvals/[id]            Approval decision
/approvals/rules           Rule configuration
/approvals/rules/[id]      Rule detail
/discrepancies             Discrepancy tracking
/discrepancies/[id]        Discrepancy resolution
/shipments                 Shipment management
/shipments/[id]            Shipment detail
/shipments/[id]/pod        Proof of delivery
/shipments/[id]/packing-slip  Packing slip generation
/shipments/export/detrack  Detrack CSV export
/receiving                 Receiving station
/receiving/confirm         Item confirmation
/receiving/history         Receipt history
/receiving/search          Search by PO/tracking/order
/inventory                 Inventory management
/inventory/[id]            Item detail
/inventory/[id]/adjust     Stock adjustment
/inventory/[id]/allocate   Stock allocation
/inventory/low-stock       Reorder alerts
/suppliers                 Vendor performance
/suppliers/[name]          Vendor detail
/quickbooks/connect        QB OAuth initiate
/quickbooks/callback       QB OAuth callback
/quickbooks/disconnect     QB token revocation
/quickbooks/status         QB connection status
/quickbooks/sync           General sync
/quickbooks/sync/customers Customer sync
/quickbooks/sync/bills     Bill sync
/quickbooks/sync/invoices  Invoice sync
/quickbooks/import/*       Import from QB
/hubspot/sync              HubSpot sync
/hubspot/status            HubSpot connection check
/hubspot/import/*          Import from HubSpot
/import/upload             CSV upload
/import/preview            Column mapping preview
/import/execute            Execute import
/import/templates          Download templates
/dashboard                 Stats aggregation
/analytics                 Spend analytics
/reports                   Report generation
/tracker                   Order lifecycle tracker
/search                    Global cross-entity search
/alerts, /alerts/[id]      Notification system
/settings                  System settings
/email/test                Email delivery test
```

## Workflow Rules

### Enforced Progression
- Cannot move to "purchased" without: order number, purchase date, vendor
- Cannot move to "received" without: received quantity, received date
- Cannot close an order without all items received or cancelled with reason
- Cannot create a quote without at least one line item with price and source

### Round-Robin Assignment
- New requests auto-assign to rep with fewest open requests
- Client-specific rep overrides (via assignedRepId)
- Manual reassignment for managers

### PO Validation and Rejection
- PO reviewed against quote (if quote-based)
- Invalid POs returned to sales with rejection reason
- Rejection count tracked for pattern detection
- Email alert sent to SDR on rejection

### Approval Rules
- Configurable triggers: entity type + field + operator + threshold
- Example: POs over $5,000 require MANAGER approval
- Role-based or user-specific approver assignment
- Escalation path for time-sensitive approvals

### Aging Rules
- Green: within expected timeframe
- Yellow: 1 day before expected delivery with no update
- Red: past expected delivery date with no "received" status
- Alerts generated at yellow and red transitions

### Missing Item Flow
1. Item hits red status (overdue)
2. Alert sent to original sourcing agent
3. Sourcing agent investigates, updates status
4. If re-sourced, routes to purchasing agent for approval
5. Manager gets summary of all missing items

## Pages (31 total)

```
/(auth)/login              Login page with demo credentials
/(dashboard)/              Main dashboard
/(dashboard)/clients       Client listing (paginated)
/(dashboard)/clients/[id]  Client detail with history
/(dashboard)/requests      Request listing with filters
/(dashboard)/requests/[id] Request detail
/(dashboard)/quotes        Quote listing
/(dashboard)/quotes/[id]   Quote detail with line items
/(dashboard)/orders        PO listing with status pipeline
/(dashboard)/orders/[id]   PO detail with item tracking
/(dashboard)/procurement   Procurement workflow overview
/(dashboard)/invoices      Vendor invoice listing
/(dashboard)/invoices/[id] Invoice detail
/(dashboard)/billing       Client invoice listing
/(dashboard)/billing/[id]  Client invoice detail
/(dashboard)/matching      3-way matching interface
/(dashboard)/approvals     Approval queue
/(dashboard)/discrepancies Discrepancy listing
/(dashboard)/receiving     Receiving station
/(dashboard)/delivery      Shipment listing
/(dashboard)/delivery/[id] Shipment detail with POD
/(dashboard)/inventory     Inventory item listing
/(dashboard)/inventory/[id] Inventory item detail
/(dashboard)/import        Data import wizard
/(dashboard)/suppliers     Vendor performance
/(dashboard)/suppliers/[name] Vendor detail
/(dashboard)/tracker       Order lifecycle tracker
/(dashboard)/analytics     Spend analytics
/(dashboard)/reports       Management reports
/(dashboard)/alerts        Notification center
/(dashboard)/settings      System settings
/(dashboard)/settings/quickbooks  QuickBooks integration
/(dashboard)/settings/hubspot     HubSpot integration
```

## Seed Data
Realistic demo data for all features:
- 6 users (admin, manager, 2 sales, procurement, operations)
- 10 clients (NYC schools, libraries, universities, healthcare, nonprofits)
- 20 requests across all statuses
- 15 quotes with line items and calculated totals
- 5 purchase orders with real dollar amounts ($564 to $7,173)
- 5 vendor invoices with line items
- 5 match records across all match statuses
- 3 approval rules + 6 approval requests
- 5 discrepancies across all types
- 5 shipments with items, across all delivery statuses
- 10 inventory items with 15 movements
- 5 client invoices across all billing statuses
- 10 alerts, 20 activity logs, 15 notes

**Demo credentials**: admin@lotus.com / password123 (all 6 accounts use password123)

## Security
- JWT sessions with 8-hour expiry
- Role-based access control on every route (middleware-enforced)
- Zod validation on all API inputs
- CSRF protection via NextAuth.js
- Prisma parameterized queries (SQL injection prevention)
- React built-in XSS escaping
- Audit trail via ActivityLog model
- Secrets managed via environment variables (never committed)
- Production secrets rotated after exposure incident

## Quality Bar
- Agency-level design, client-presentable from day one
- Clean TypeScript, strict mode, no `any` types
- Responsive design (works on tablet for warehouse use)
- Loading states, error states, empty states for everything
- Accessible (WCAG 2.1 AA minimum)
- Sub-2s page loads with Turbopack optimization
