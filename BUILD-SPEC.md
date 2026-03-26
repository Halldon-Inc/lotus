# Lotus Connect Portal - Full Build Specification

## Overview
Centralized procurement and order management portal for Lotus Connect, a government and educational procurement company. Replaces their current mess of disconnected Google Sheets with a unified, workflow-enforced system.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js with role-based access control
- **Real-time**: Server-Sent Events for notifications
- **Deployment**: Render (or Vercel-ready)
- **Testing**: Vitest + Playwright

## Design Direction

### Color Palette (from Lotus Connect branding)
- **Primary**: Deep teal/green (#0D7377 range) - from Lotus logo
- **Secondary**: Gold/amber (#D4A843 range) - accent from Lotus site
- **Background**: Clean whites and light grays (#F8FAFB, #FFFFFF)
- **Surface**: Soft gray cards (#F1F5F9)
- **Text**: Dark charcoal (#1A1A2E) for headings, (#4A5568) for body
- **Success**: Green (#10B981)
- **Warning**: Amber (#F59E0B)
- **Danger**: Red (#EF4444)
- **Info**: Blue (#3B82F6)

### Vibes (Halldon quality standard)
- Clean, modern, premium feel - NOT generic template energy
- Generous whitespace, intentional spacing
- Smooth transitions and micro-interactions
- Dashboard should feel like a command center, not a spreadsheet
- Cards and panels with subtle shadows, rounded corners
- Professional but not corporate-boring

### UX (HubSpot familiarity)
- Left sidebar navigation (collapsible)
- Top bar with search, notifications bell, user avatar
- Kanban-style pipeline views for orders
- Detail panels that slide in from the right
- Data tables with sorting, filtering, search
- Status pills with color coding (red/yellow/green aging)
- Breadcrumb navigation

## Database Schema

### Core Entities

#### Users
- id, email, name, role (admin/manager/sales/procurement/operations), avatar
- department, phone, isActive
- Timestamps

#### Clients (Schools/Organizations)
- id, name, type (school/government/healthcare/etc)
- address, city, state, zip
- contactName, contactEmail, contactPhone
- fiscalYearStart, spendingLimit
- hubspotId (for future integration)
- assignedRepId (FK to Users)
- Timestamps

#### Requests (Incoming from email/manual)
- id, clientId, assignedToId, createdById
- subject, description, source (email/manual/hubspot)
- priority (low/medium/high/urgent)
- status (new/assigned/in-progress/quoted/closed)
- Timestamps

#### Quotes
- id, requestId, clientId, createdById
- quoteNumber (auto-generated)
- totalAmount, status (draft/sent/accepted/rejected/expired)
- validUntil, sentAt
- hubspotQuoteId
- Timestamps

#### QuoteLineItems
- id, quoteId
- productName, description, specifications (JSON - color, size, material, etc.)
- quantity, unitPrice, totalPrice
- sourceUrl, vendorName
- Timestamps

#### PurchaseOrders
- id, quoteId, clientId
- poNumber (client's PO number)
- totalAmount, status (received/verified/in-purchasing/partially-fulfilled/fulfilled/delivered)
- receivedAt, verifiedById
- discrepancyNotes (if PO doesn't match quote)
- Timestamps

#### PurchaseOrderItems
- id, purchaseOrderId, quoteLineItemId
- quantity (may differ from quote)
- status (pending/sourced/purchased/shipped/received/missing)
- sourcedById, sourcedAt, sourceUrl, vendorName
- purchasedById, purchasedAt, orderNumber, expectedDeliveryDate
- receivedAt, receivedQuantity
- trackingNumber, confirmationScreenshot
- Timestamps

#### Alerts
- id, userId (who should see it)
- type (missing-item/overdue/attention-required/deadline/system)
- title, message
- relatedEntityType, relatedEntityId
- isRead, readAt
- severity (info/warning/critical)
- Timestamps

#### ActivityLog
- id, userId, entityType, entityId
- action (created/updated/status-changed/assigned/note-added)
- details (JSON)
- Timestamps

#### Notes
- id, entityType, entityId, userId
- content
- Timestamps

## Features by Phase

### Phase 1: Core Pipeline (Foundation)
1. **Auth & Roles**: Login, role-based dashboards, permissions
2. **Client Management**: CRUD clients, view client history, spending tracker
3. **Request Intake**: Create requests manually, assign to reps (round-robin or manual)
4. **Dashboard**: Command center with pipeline overview, stats cards, recent activity

### Phase 2: Order Flow
5. **Quote Builder**: Create quotes with line items, specs, pricing, vendor sources
6. **PO Processing**: Receive POs, verify against quotes, flag discrepancies
7. **Procurement Workflow**: Purchasing queue, source/buy/track flow with enforced steps
8. **Status Pipeline**: Kanban view of all orders moving through stages

### Phase 3: Tracking & Alerts
9. **Missing Item Tracker**: Auto-flag items not received by expected date
10. **Aging Indicators**: Red/yellow/green on all items based on time thresholds
11. **Alert System**: In-app notifications, daily digest reports
12. **Daily Reports**: Auto-generated management reports (overdue items, open orders, rep performance)

### Phase 4: Intelligence & Reporting
13. **Client Spending Reports**: Fiscal year tracking, spending limits, quarterly views
14. **Rep Performance**: Orders per rep, resolution times, missing item rates
15. **Pipeline Analytics**: Conversion rates, average fulfillment time, bottleneck identification
16. **Search**: Global search across all entities

### Phase 5: Integrations (Architecture Only)
17. **HubSpot Sync**: Two-way data flow architecture (API endpoints ready, not connected yet)
18. **Export**: CSV/PDF export for all reports
19. **Email Notifications**: Configurable email alerts for critical events

## Workflow Rules (CRITICAL)

### Enforced Progression
- Cannot move an order to "purchased" without entering: order number, purchase date, vendor
- Cannot move to "received" without entering: received quantity, received date
- Cannot close an order without all items received or marked as cancelled with reason
- Cannot create a quote without at least one line item with price and source

### Round-Robin Assignment
- New requests auto-assign to the rep with the fewest open requests
- Override: specific clients always go to specific reps (configurable)
- Manual reassignment available for managers

### Aging Rules
- Green: within expected timeframe
- Yellow: 1 day before expected delivery with no update
- Red: past expected delivery date with no "received" status
- Auto-alert generated at yellow and red transitions

### Missing Item Flow
1. Item hits red status (overdue)
2. Alert sent to original sourcing agent
3. Sourcing agent investigates, updates status
4. If re-sourced, routes to purchasing agent for approval and buy
5. Manager gets daily summary of all missing items

## API Structure
All API routes under `/api/v1/`:
- `/auth/*` - Authentication
- `/users/*` - User management
- `/clients/*` - Client CRUD + spending reports
- `/requests/*` - Request intake + assignment
- `/quotes/*` - Quote builder + line items
- `/purchase-orders/*` - PO management
- `/items/*` - Individual item tracking
- `/alerts/*` - Notification system
- `/reports/*` - Report generation
- `/dashboard/*` - Dashboard stats
- `/search/*` - Global search

## Security Requirements
- All data encrypted at rest and in transit
- Role-based access control on every route
- Input validation and sanitization on all endpoints
- CSRF protection
- Rate limiting on API routes
- Audit trail for all data changes (ActivityLog)
- Session management with proper expiry
- No client data exposed in URLs or logs
- SQL injection prevention via Prisma parameterized queries
- XSS prevention via React's built-in escaping + CSP headers

## File Structure
```
lotus/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx (main dashboard)
│   │   │   ├── clients/
│   │   │   ├── requests/
│   │   │   ├── quotes/
│   │   │   ├── orders/
│   │   │   ├── procurement/
│   │   │   ├── reports/
│   │   │   ├── alerts/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   └── v1/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/ (shadcn)
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── clients/
│   │   ├── procurement/
│   │   └── shared/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── utils.ts
│   │   └── validations/
│   ├── hooks/
│   ├── types/
│   └── middleware.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## Seed Data
Include realistic demo data:
- 5 users (admin, 2 sales reps, 1 procurement, 1 operations)
- 10 clients (schools in NYC, government orgs)
- 20 requests in various stages
- 15 quotes with line items
- 10 purchase orders
- Various items in different statuses (purchased, received, missing, overdue)
- Sample alerts and activity logs

## Quality Bar
- Agency-level design. Client-presentable from day one.
- Clean code, proper TypeScript types, no `any`.
- Responsive design (works on tablet for warehouse use).
- Loading states, error states, empty states for everything.
- Accessible (WCAG 2.1 AA minimum).
- Performance: sub-2s page loads, optimistic updates.
