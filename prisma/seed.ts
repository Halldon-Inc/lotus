import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
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
      email: 'sales1@lotus.com',
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

    // Update quote total
    await prisma.quote.update({
      where: { id: quote.id },
      data: { totalAmount: quoteTotal },
    })
  }

  console.log('✓ Created quotes and line items')

  // Create purchase orders (10 purchase orders from accepted quotes)
  const acceptedQuotes = quotes.filter((_, i) => i % 3 === 2).slice(0, 10) // Take accepted quotes
  
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
