import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data (order matters for foreign keys)
  await prisma.inventoryMovement.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.shipmentItem.deleteMany()
  await prisma.shipment.deleteMany()
  await prisma.clientInvoice.deleteMany()
  await prisma.matchRecord.deleteMany()
  await prisma.invoiceLineItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.discrepancy.deleteMany()
  await prisma.approvalRequest.deleteMany()
  await prisma.approvalRule.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.note.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.purchaseOrderItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.quoteLineItem.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.request.deleteMany()
  await prisma.client.deleteMany()
  await prisma.user.deleteMany()

  // Create users (5 users as specified)
  const hashedPassword = await bcrypt.hash('password123', 12)
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@lotus.com',
      name: 'Admin User',
      role: 'ADMIN',
      department: 'Administration',
      phone: '555-0001',
      isActive: true,
    },
  })

  const manager = await prisma.user.create({
    data: {
      email: 'manager@lotus.com',
      name: 'Jane Manager',
      role: 'MANAGER',
      department: 'Sales',
      phone: '555-0002',
      isActive: true,
    },
  })

  const salesRep1 = await prisma.user.create({
    data: {
      email: 'sales@lotus.com',
      name: 'John Sales',
      role: 'SALES',
      department: 'Sales',
      phone: '555-0003',
      isActive: true,
    },
  })

  const salesRep2 = await prisma.user.create({
    data: {
      email: 'sales2@lotus.com',
      name: 'Sarah Sales',
      role: 'SALES',
      department: 'Sales',
      phone: '555-0004',
      isActive: true,
    },
  })

  const procurement = await prisma.user.create({
    data: {
      email: 'procurement@lotus.com',
      name: 'Mike Procurement',
      role: 'PROCUREMENT',
      department: 'Procurement',
      phone: '555-0005',
      isActive: true,
    },
  })

  const operations = await prisma.user.create({
    data: {
      email: 'operations@lotus.com',
      name: 'Lisa Operations',
      role: 'OPERATIONS',
      department: 'Operations',
      phone: '555-0006',
      isActive: true,
    },
  })

  console.log('✓ Created users')

  // Create clients (10 clients - schools and government orgs in NYC)
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: 'NYC Department of Education',
        type: 'GOVERNMENT',
        address: '52 Chambers St',
        city: 'New York',
        state: 'NY',
        zip: '10007',
        contactName: 'Robert Chen',
        contactEmail: 'r.chen@schools.nyc.gov',
        contactPhone: '718-555-1001',
        fiscalYearStart: new Date('2023-07-01'),
        spendingLimit: 500000,
        assignedRepId: salesRep1.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Columbia University',
        type: 'SCHOOL',
        address: '116th St & Broadway',
        city: 'New York',
        state: 'NY',
        zip: '10027',
        contactName: 'Dr. Emily Watson',
        contactEmail: 'e.watson@columbia.edu',
        contactPhone: '212-555-1002',
        fiscalYearStart: new Date('2023-07-01'),
        spendingLimit: 750000,
        assignedRepId: salesRep2.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Brooklyn Public Library',
        type: 'GOVERNMENT',
        address: '10 Grand Army Plaza',
        city: 'Brooklyn',
        state: 'NY',
        zip: '11238',
        contactName: 'Maria Rodriguez',
        contactEmail: 'm.rodriguez@bklynlibrary.org',
        contactPhone: '718-555-1003',
        fiscalYearStart: new Date('2023-01-01'),
        spendingLimit: 200000,
        assignedRepId: salesRep1.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Hunter College',
        type: 'SCHOOL',
        address: '695 Park Ave',
        city: 'New York',
        state: 'NY',
        zip: '10065',
        contactName: 'Prof. James Liu',
        contactEmail: 'j.liu@hunter.cuny.edu',
        contactPhone: '212-555-1004',
        fiscalYearStart: new Date('2023-09-01'),
        spendingLimit: 400000,
        assignedRepId: salesRep2.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Queens Borough Public Library',
        type: 'GOVERNMENT',
        address: '89-11 Merrick Blvd',
        city: 'Jamaica',
        state: 'NY',
        zip: '11432',
        contactName: 'David Park',
        contactEmail: 'd.park@queenslibrary.org',
        contactPhone: '718-555-1005',
        fiscalYearStart: new Date('2023-01-01'),
        spendingLimit: 150000,
        assignedRepId: salesRep1.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'The New School',
        type: 'SCHOOL',
        address: '66 W 12th St',
        city: 'New York',
        state: 'NY',
        zip: '10011',
        contactName: 'Andrea Foster',
        contactEmail: 'a.foster@newschool.edu',
        contactPhone: '212-555-1006',
        fiscalYearStart: new Date('2023-07-01'),
        spendingLimit: 300000,
        assignedRepId: salesRep2.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Bronx Community Health Network',
        type: 'HEALTHCARE',
        address: '1276 Fulton Ave',
        city: 'Bronx',
        state: 'NY',
        zip: '10456',
        contactName: 'Dr. Carlos Mendez',
        contactEmail: 'c.mendez@bchn.org',
        contactPhone: '718-555-1007',
        fiscalYearStart: new Date('2023-01-01'),
        spendingLimit: 250000,
        assignedRepId: salesRep1.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Staten Island Museum',
        type: 'NONPROFIT',
        address: '75 Stuyvesant Pl',
        city: 'Staten Island',
        state: 'NY',
        zip: '10301',
        contactName: 'Jennifer Walsh',
        contactEmail: 'j.walsh@simuseum.org',
        contactPhone: '718-555-1008',
        fiscalYearStart: new Date('2023-01-01'),
        spendingLimit: 75000,
        assignedRepId: salesRep2.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Pace University',
        type: 'SCHOOL',
        address: '1 Pace Plaza',
        city: 'New York',
        state: 'NY',
        zip: '10038',
        contactName: 'Thomas Kim',
        contactEmail: 't.kim@pace.edu',
        contactPhone: '212-555-1009',
        fiscalYearStart: new Date('2023-08-01'),
        spendingLimit: 600000,
        assignedRepId: salesRep1.id,
      },
    }),

    prisma.client.create({
      data: {
        name: 'Manhattan Community College',
        type: 'SCHOOL',
        address: '199 Chambers St',
        city: 'New York',
        state: 'NY',
        zip: '10007',
        contactName: 'Susan Davis',
        contactEmail: 's.davis@bmcc.cuny.edu',
        contactPhone: '212-555-1010',
        fiscalYearStart: new Date('2023-09-01'),
        spendingLimit: 200000,
        assignedRepId: salesRep2.id,
      },
    }),
  ])

  console.log('✓ Created clients')

  // Create requests (20 requests in various stages)
  const requests = []
  
  // New requests
  for (let i = 0; i < 5; i++) {
    const request = await prisma.request.create({
      data: {
        clientId: clients[i % clients.length].id,
        createdById: salesRep1.id,
        subject: `Office Supplies Request ${i + 1}`,
        description: 'Need various office supplies including paper, pens, folders, and desk accessories for the upcoming semester.',
        source: 'EMAIL',
        priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
        status: 'NEW',
      },
    })
    requests.push(request)
  }

  // Assigned requests
  for (let i = 5; i < 10; i++) {
    const request = await prisma.request.create({
      data: {
        clientId: clients[i % clients.length].id,
        assignedToId: salesRep2.id,
        createdById: manager.id,
        subject: `Technology Equipment Request ${i + 1}`,
        description: 'Request for laptops, monitors, keyboards, and mice for computer lab upgrade.',
        source: 'MANUAL',
        priority: ['MEDIUM', 'HIGH', 'URGENT'][i % 3],
        status: 'ASSIGNED',
      },
    })
    requests.push(request)
  }

  // In progress requests
  for (let i = 10; i < 15; i++) {
    const request = await prisma.request.create({
      data: {
        clientId: clients[i % clients.length].id,
        assignedToId: salesRep1.id,
        createdById: salesRep1.id,
        subject: `Furniture Request ${i + 1}`,
        description: 'Office furniture including desks, chairs, filing cabinets, and conference tables.',
        source: 'HUBSPOT',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      },
    })
    requests.push(request)
  }

  // Quoted requests
  for (let i = 15; i < 20; i++) {
    const request = await prisma.request.create({
      data: {
        clientId: clients[i % clients.length].id,
        assignedToId: salesRep2.id,
        createdById: salesRep2.id,
        subject: `Cleaning Supplies Request ${i + 1}`,
        description: 'Bulk cleaning supplies, sanitizers, paper towels, and maintenance equipment.',
        source: 'EMAIL',
        priority: 'MEDIUM',
        status: 'QUOTED',
      },
    })
    requests.push(request)
  }

  console.log('✓ Created requests')

  // Create quotes (15 quotes with line items)
  const quotes = []
  
  for (let i = 0; i < 15; i++) {
    const quote = await prisma.quote.create({
      data: {
        requestId: requests[i + 5].id, // Skip first 5 new requests
        clientId: requests[i + 5].clientId,
        createdById: i % 2 === 0 ? salesRep1.id : salesRep2.id,
        quoteNumber: `QT-${Date.now()}-${String(i + 1).padStart(3, '0')}`,
        status: ['DRAFT', 'SENT', 'ACCEPTED'][i % 3],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        sentAt: i % 3 > 0 ? new Date() : null,
      },
    })
    quotes.push(quote)

    // Create line items for each quote
    const lineItemCount = Math.floor(Math.random() * 5) + 1 // 1-5 line items per quote
    let quoteTotal = 0

    for (let j = 0; j < lineItemCount; j++) {
      const quantity = Math.floor(Math.random() * 50) + 1
      const unitPrice = Math.floor(Math.random() * 100) + 10
      const totalPrice = quantity * unitPrice
      quoteTotal += totalPrice

      await prisma.quoteLineItem.create({
        data: {
          quoteId: quote.id,
          productName: [
            'Office Chair', 'Standing Desk', 'Monitor', 'Laptop',
            'Printer Paper', 'Stapler', 'File Folders', 'Whiteboard',
            'Cleaning Supplies', 'Hand Sanitizer'
          ][j % 10],
          description: 'Professional grade item for office use',
          specifications: JSON.stringify({
            color: ['Black', 'White', 'Gray'][j % 3],
            material: ['Plastic', 'Metal', 'Wood'][j % 3],
            size: ['Small', 'Medium', 'Large'][j % 3],
          }),
          quantity,
          unitPrice,
          totalPrice,
          sourceUrl: 'https://example-vendor.com/product',
          vendorName: ['OfficeMax', 'Staples', 'Amazon Business'][j % 3],
        },
      })
    }

    // Update quote total (both in DB and in-memory so POs get the correct amount)
    const updatedQuote = await prisma.quote.update({
      where: { id: quote.id },
      data: { totalAmount: quoteTotal },
    })
    quotes[quotes.length - 1] = updatedQuote
  }

  console.log('✓ Created quotes and line items')

  // Create purchase orders (10 purchase orders from accepted quotes)
  const acceptedQuotes = quotes.filter((_, i) => i % 3 === 2).slice(0, 10) // Take accepted quotes
  const purchaseOrders = []

  for (let i = 0; i < Math.min(10, acceptedQuotes.length); i++) {
    const quote = acceptedQuotes[i]

    const po = await prisma.purchaseOrder.create({
      data: {
        quoteId: quote.id,
        clientId: quote.clientId,
        poNumber: `PO-${Date.now()}-${String(i + 1).padStart(4, '0')}`,
        totalAmount: quote.totalAmount,
        status: ['RECEIVED', 'VERIFIED', 'IN_PURCHASING', 'PARTIALLY_FULFILLED', 'FULFILLED'][i % 5],
        verifiedById: manager.id,
      },
    })

    // Create purchase order items
    const quoteLineItems = await prisma.quoteLineItem.findMany({
      where: { quoteId: quote.id },
    })

    purchaseOrders.push(po)

    for (const lineItem of quoteLineItems) {
      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          quoteLineItemId: lineItem.id,
          quantity: lineItem.quantity,
          status: ['PENDING', 'SOURCED', 'PURCHASED', 'SHIPPED', 'RECEIVED', 'MISSING'][Math.floor(Math.random() * 6)],
          sourcedById: procurement.id,
          sourcedAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
          sourceUrl: lineItem.sourceUrl,
          vendorName: lineItem.vendorName,
          purchasedById: procurement.id,
          purchasedAt: Math.random() > 0.3 ? new Date() : null,
          orderNumber: Math.random() > 0.3 ? `ORD-${Math.floor(Math.random() * 10000)}` : null,
          expectedDeliveryDate: new Date(Date.now() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000),
          receivedQuantity: Math.random() > 0.4 ? lineItem.quantity : 0,
          trackingNumber: Math.random() > 0.5 ? `TRK-${Math.floor(Math.random() * 1000000)}` : null,
        },
      })
    }
  }

  console.log('✓ Created purchase orders and items')

  // Create alerts
  const alertTypes = ['MISSING_ITEM', 'OVERDUE', 'ATTENTION_REQUIRED', 'DEADLINE', 'SYSTEM']
  const severities = ['INFO', 'WARNING', 'CRITICAL']
  
  for (let i = 0; i < 10; i++) {
    await prisma.alert.create({
      data: {
        userId: [admin, manager, salesRep1, salesRep2, procurement, operations][i % 6].id,
        type: alertTypes[i % alertTypes.length],
        title: `Alert ${i + 1}: Action Required`,
        message: `This is a sample alert message describing an issue that needs attention.`,
        severity: severities[i % severities.length],
        isRead: Math.random() > 0.5,
        relatedEntityType: 'purchase_order_item',
        relatedEntityId: 'sample-id',
      },
    })
  }

  console.log('✓ Created alerts')

  // Create activity logs
  const actions = ['created', 'updated', 'status-changed', 'assigned', 'note-added']
  const entityTypes = ['request', 'quote', 'purchase_order', 'client']
  
  for (let i = 0; i < 20; i++) {
    await prisma.activityLog.create({
      data: {
        userId: [admin, manager, salesRep1, salesRep2, procurement, operations][i % 6].id,
        entityType: entityTypes[i % entityTypes.length],
        entityId: `entity-${i + 1}`,
        action: actions[i % actions.length],
        details: JSON.stringify({
          field: 'status',
          oldValue: 'old',
          newValue: 'new',
          timestamp: new Date().toISOString(),
        }),
      },
    })
  }

  console.log('✓ Created activity logs')

  // Create notes
  for (let i = 0; i < 15; i++) {
    await prisma.note.create({
      data: {
        entityType: entityTypes[i % entityTypes.length],
        entityId: `entity-${i + 1}`,
        userId: [admin, manager, salesRep1, salesRep2, procurement, operations][i % 6].id,
        content: `This is a sample note ${i + 1} with some details about the entity.`,
      },
    })
  }

  console.log('✓ Created notes')

  // === NEW SEED SECTIONS: populate all empty demo areas ===

  // Vendor Invoices (linked to POs)
  const invoices = []
  const vendorNames = ['Staples Business', 'Amazon Business', 'OfficeMax Pro', 'Dell Technologies', 'W.B. Mason']
  for (let i = 0; i < Math.min(5, purchaseOrders.length); i++) {
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-2026-${String(i + 1).padStart(4, '0')}`,
        vendorName: vendorNames[i],
        totalAmount: purchaseOrders[i].totalAmount * (0.95 + Math.random() * 0.1),
        status: ['PENDING', 'MATCHED', 'PARTIAL', 'DISPUTED', 'PAID'][i % 5],
        receivedAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + (20 + i * 5) * 24 * 60 * 60 * 1000),
        purchaseOrderId: purchaseOrders[i].id,
        notes: `Vendor invoice from ${vendorNames[i]} for PO ${purchaseOrders[i].poNumber}`,
      },
    })
    invoices.push(inv)

    // Add 2-3 line items per invoice
    const itemCount = 2 + (i % 2)
    for (let j = 0; j < itemCount; j++) {
      const qty = Math.floor(Math.random() * 20) + 5
      const price = Math.floor(Math.random() * 80) + 15
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: inv.id,
          description: ['Copy Paper (Case)', 'Ergonomic Chair', 'LED Monitor 27"', 'Wireless Keyboard', 'Standing Desk Mat', 'Whiteboard Markers (12pk)', 'Filing Cabinet 3-Drawer'][j % 7],
          quantity: qty,
          unitPrice: price,
          totalPrice: qty * price,
        },
      })
    }
  }
  console.log('✓ Created vendor invoices')

  // Match Records (3-way matching: PO vs Invoice vs Received)
  for (let i = 0; i < Math.min(5, invoices.length); i++) {
    await prisma.matchRecord.create({
      data: {
        purchaseOrderId: purchaseOrders[i].id,
        invoiceId: invoices[i].id,
        status: ['AUTO_MATCHED', 'PARTIAL_MATCH', 'MISMATCH', 'MANUAL_OVERRIDE', 'AUTO_MATCHED'][i % 5],
        matchedAt: i % 5 !== 2 ? new Date() : null,
        toleranceUsed: i % 5 === 1 ? 2.5 : null,
        notes: i % 5 === 2 ? 'Price discrepancy of $47.50 on line item 2' : null,
        details: JSON.stringify({
          poTotal: purchaseOrders[i].totalAmount,
          invoiceTotal: invoices[i].totalAmount,
          variance: Math.abs(purchaseOrders[i].totalAmount - invoices[i].totalAmount),
          matchedItems: 3 + i,
          totalItems: 4 + i,
        }),
      },
    })
  }
  console.log('✓ Created match records')

  // Approval Rules + Requests
  const approvalRules = []
  const ruleConfigs = [
    { name: 'High Value PO Approval', entityType: 'PURCHASE_ORDER', field: 'totalAmount', op: 'gt', value: '5000', role: 'MANAGER' },
    { name: 'Urgent Request Escalation', entityType: 'REQUEST', field: 'priority', op: 'eq', value: 'URGENT', role: 'ADMIN' },
    { name: 'Large Invoice Review', entityType: 'INVOICE', field: 'totalAmount', op: 'gt', value: '10000', role: 'MANAGER' },
  ]
  for (const rc of ruleConfigs) {
    const rule = await prisma.approvalRule.create({
      data: {
        name: rc.name,
        entityType: rc.entityType,
        conditionField: rc.field,
        conditionOp: rc.op,
        conditionValue: rc.value,
        approverRole: rc.role,
        approverUserId: rc.role === 'ADMIN' ? admin.id : manager.id,
        priority: ruleConfigs.indexOf(rc),
        isActive: true,
      },
    })
    approvalRules.push(rule)
  }

  const approvalStatuses = ['PENDING', 'APPROVED', 'APPROVED', 'REJECTED', 'PENDING', 'ESCALATED']
  for (let i = 0; i < 6; i++) {
    const status = approvalStatuses[i]
    await prisma.approvalRequest.create({
      data: {
        entityType: ['PURCHASE_ORDER', 'REQUEST', 'INVOICE'][i % 3],
        entityId: i < purchaseOrders.length ? purchaseOrders[i % purchaseOrders.length].id : `entity-${i}`,
        ruleId: approvalRules[i % approvalRules.length].id,
        requestedById: [salesRep1, salesRep2, procurement][i % 3].id,
        approverId: status !== 'PENDING' ? (i % 2 === 0 ? admin.id : manager.id) : null,
        status,
        resolvedAt: status !== 'PENDING' && status !== 'ESCALATED' ? new Date() : null,
        notes: status === 'REJECTED' ? 'Budget exceeded for this quarter. Resubmit in Q2.' : null,
      },
    })
  }
  console.log('✓ Created approval rules and requests')

  // Discrepancies
  const discTypes = ['QUANTITY_MISMATCH', 'PRICE_MISMATCH', 'WRONG_ITEM', 'DAMAGED', 'MISSING']
  const discStatuses = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'OPEN']
  for (let i = 0; i < 5; i++) {
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: purchaseOrders[i % purchaseOrders.length].id },
      take: 1,
    })
    await prisma.discrepancy.create({
      data: {
        purchaseOrderId: purchaseOrders[i % purchaseOrders.length].id,
        purchaseOrderItemId: poItems.length > 0 ? poItems[0].id : null,
        invoiceId: i < invoices.length ? invoices[i].id : null,
        type: discTypes[i],
        expectedValue: ['50', '24.99', 'Ergonomic Chair', 'New condition', '10 units'][i],
        actualValue: ['42', '29.99', 'Standard Chair', 'Damaged box', '0 units'][i],
        status: discStatuses[i],
        reportedById: operations.id,
        resolvedById: discStatuses[i] === 'RESOLVED' ? procurement.id : null,
        resolvedAt: discStatuses[i] === 'RESOLVED' ? new Date() : null,
        resolutionNotes: discStatuses[i] === 'RESOLVED' ? 'Vendor issued credit memo for difference' : null,
      },
    })
  }
  console.log('✓ Created discrepancies')

  // Shipments
  const shipStatuses = ['PREPARING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'IN_TRANSIT']
  const carriers = ['UPS Ground', 'FedEx Express', null, 'USPS Priority', 'FedEx Ground']
  for (let i = 0; i < Math.min(5, purchaseOrders.length); i++) {
    const shipment = await prisma.shipment.create({
      data: {
        purchaseOrderId: purchaseOrders[i].id,
        method: carriers[i] ? 'CARRIER' : 'MANUAL',
        carrierName: carriers[i],
        trackingNumber: carriers[i] ? `1Z${Math.floor(Math.random() * 9999999999)}` : null,
        scheduledDate: new Date(Date.now() + (i - 2) * 24 * 60 * 60 * 1000),
        shippedAt: i >= 2 ? new Date(Date.now() - (4 - i) * 24 * 60 * 60 * 1000) : null,
        deliveredAt: i === 3 ? new Date() : null,
        podStatus: i === 3 ? 'VERIFIED' : 'NONE',
        status: shipStatuses[i],
        notes: i === 0 ? 'Awaiting final packing list confirmation' : null,
      },
    })

    // Add shipment items from PO items
    const poItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: purchaseOrders[i].id },
      take: 3,
    })
    for (let j = 0; j < poItems.length; j++) {
      await prisma.shipmentItem.create({
        data: {
          shipmentId: shipment.id,
          purchaseOrderItemId: poItems[j].id,
          quantity: poItems[j].quantity,
          boxNumber: j + 1,
        },
      })
    }
  }
  console.log('✓ Created shipments')

  // Inventory Items + Movements
  const inventoryData = [
    { name: 'Copy Paper (Letter)', sku: 'PAP-LTR-001', category: 'Paper', qty: 250, reorder: 50, cost: 5.99 },
    { name: 'Copy Paper (Legal)', sku: 'PAP-LGL-002', category: 'Paper', qty: 80, reorder: 30, cost: 7.49 },
    { name: 'Ballpoint Pens (Box of 12)', sku: 'PEN-BLU-003', category: 'Writing', qty: 45, reorder: 20, cost: 8.99 },
    { name: 'Manila Folders (100pk)', sku: 'FLD-MNL-004', category: 'Filing', qty: 12, reorder: 15, cost: 24.99 },
    { name: 'Ergonomic Office Chair', sku: 'FRN-CHR-005', category: 'Furniture', qty: 8, reorder: 3, cost: 349.00 },
    { name: 'Standing Desk 60"', sku: 'FRN-DSK-006', category: 'Furniture', qty: 3, reorder: 2, cost: 599.00 },
    { name: 'Dell Monitor 27" 4K', sku: 'TEC-MON-007', category: 'Technology', qty: 15, reorder: 5, cost: 329.00 },
    { name: 'Wireless Keyboard/Mouse Combo', sku: 'TEC-KBM-008', category: 'Technology', qty: 22, reorder: 10, cost: 49.99 },
    { name: 'Hand Sanitizer (Gallon)', sku: 'CLN-SAN-009', category: 'Cleaning', qty: 6, reorder: 10, cost: 18.99 },
    { name: 'Whiteboard Markers (Assorted)', sku: 'WRT-MRK-010', category: 'Writing', qty: 35, reorder: 15, cost: 12.49 },
  ]

  const inventoryItems = []
  for (const item of inventoryData) {
    const inv = await prisma.inventoryItem.create({
      data: {
        name: item.name,
        sku: item.sku,
        description: `${item.category} supply for office procurement`,
        category: item.category,
        quantityOnHand: item.qty,
        quantityReserved: Math.floor(item.qty * 0.2),
        reorderPoint: item.reorder,
        location: ['Warehouse A, Shelf 1', 'Warehouse A, Shelf 2', 'Warehouse B, Shelf 1', 'Warehouse B, Shelf 3', 'Warehouse C'][inventoryData.indexOf(item) % 5],
        unitCost: item.cost,
        lastRestockedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
      },
    })
    inventoryItems.push(inv)
  }

  // Inventory movements
  const movementTypes = ['RECEIVED', 'ALLOCATED', 'SHIPPED', 'RETURNED', 'ADJUSTMENT']
  for (let i = 0; i < 15; i++) {
    const item = inventoryItems[i % inventoryItems.length]
    const type = movementTypes[i % movementTypes.length]
    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type,
        quantity: type === 'RETURNED' || type === 'ADJUSTMENT' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 20) + 5,
        referenceType: type === 'ADJUSTMENT' ? 'MANUAL' : 'PURCHASE_ORDER',
        referenceId: type !== 'ADJUSTMENT' && purchaseOrders.length > 0 ? purchaseOrders[i % purchaseOrders.length].id : null,
        notes: type === 'ADJUSTMENT' ? 'Physical count reconciliation' : null,
        performedById: [operations, procurement, operations][i % 3].id,
      },
    })
  }
  console.log('✓ Created inventory items and movements')

  // Client Invoices (AR invoices sent to customers)
  for (let i = 0; i < Math.min(6, purchaseOrders.length); i++) {
    await prisma.clientInvoice.create({
      data: {
        purchaseOrderId: purchaseOrders[i].id,
        clientId: purchaseOrders[i].clientId,
        invoiceNumber: `CI-2026-${String(i + 1).padStart(4, '0')}`,
        totalAmount: purchaseOrders[i].totalAmount * 1.15,
        status: ['DRAFT', 'SENT', 'SENT', 'PAID', 'PAID', 'OVERDUE'][i],
        sentAt: i >= 1 ? new Date(Date.now() - (15 - i * 2) * 24 * 60 * 60 * 1000) : null,
        paidAt: i >= 3 && i <= 4 ? new Date(Date.now() - i * 24 * 60 * 60 * 1000) : null,
        dueDate: new Date(Date.now() + (i === 5 ? -5 : 25) * 24 * 60 * 60 * 1000),
        podVerified: i >= 3,
        notes: i === 5 ? 'Payment overdue. Follow-up email sent.' : null,
      },
    })
  }
  console.log('✓ Created client invoices')

  console.log('🎉 Seeding completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
