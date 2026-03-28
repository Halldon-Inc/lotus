import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all'
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          clients: [],
          requests: [],
          quotes: [],
          purchaseOrders: [],
        },
      })
    }

    const searchResults: {
      clients: Array<{ id: string; name: string; type: string; city: string | null; state: string | null; contactName: string | null; createdAt: Date }>
      requests: Array<{ id: string; subject: string; description: string; priority: string; status: string; createdAt: Date; client: { id: string; name: string; type: string }; assignedTo: { name: string | null } | null }>
      quotes: Array<{ id: string; quoteNumber: string; totalAmount: number; status: string; createdAt: Date; client: { id: string; name: string; type: string }; request: { subject: string }; _count: { lineItems: number } }>
      purchaseOrders: Array<{ id: string; poNumber: string; totalAmount: number; status: string; receivedAt: Date; client: { id: string; name: string; type: string }; quote: { quoteNumber: string } | null; _count: { items: number } }>
    } = {
      clients: [],
      requests: [],
      quotes: [],
      purchaseOrders: [],
    }

    // Search clients
    if (type === 'all' || type === 'clients') {
      searchResults.clients = await prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { contactName: { contains: query } },
            { contactEmail: { contains: query } },
            { city: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          city: true,
          state: true,
          contactName: true,
          createdAt: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })
    }

    // Search requests
    if (type === 'all' || type === 'requests') {
      searchResults.requests = await prisma.request.findMany({
        where: {
          OR: [
            { subject: { contains: query } },
            { description: { contains: query } },
            { client: { name: { contains: query } } },
          ],
        },
        select: {
          id: true,
          subject: true,
          description: true,
          priority: true,
          status: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          assignedTo: {
            select: {
              name: true,
            },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })
    }

    // Search quotes
    if (type === 'all' || type === 'quotes') {
      searchResults.quotes = await prisma.quote.findMany({
        where: {
          OR: [
            { quoteNumber: { contains: query } },
            { client: { name: { contains: query } } },
            { request: { subject: { contains: query } } },
            { lineItems: { some: { productName: { contains: query } } } },
          ],
        },
        select: {
          id: true,
          quoteNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          request: {
            select: {
              subject: true,
            },
          },
          _count: {
            select: {
              lineItems: true,
            },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      })
    }

    // Search purchase orders
    if (type === 'all' || type === 'orders') {
      searchResults.purchaseOrders = await prisma.purchaseOrder.findMany({
        where: {
          OR: [
            { poNumber: { contains: query } },
            { client: { name: { contains: query } } },
            { quote: { is: { quoteNumber: { contains: query } } } },
            { items: { some: { quoteLineItem: { is: { productName: { contains: query } } } } } },
          ],
        },
        select: {
          id: true,
          poNumber: true,
          totalAmount: true,
          status: true,
          receivedAt: true,
          client: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          quote: {
            select: {
              quoteNumber: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        take: limit,
        orderBy: { receivedAt: 'desc' },
      })
    }

    // Transform results for unified format
    const transformedResults = {
      clients: searchResults.clients.map((client) => ({
        id: client.id,
        type: 'client' as const,
        title: client.name,
        subtitle: `${client.type} • ${client.city || 'No city'}, ${client.state || 'No state'}`,
        status: null,
        createdAt: client.createdAt,
        url: `/clients/${client.id}`,
        metadata: {
          contactName: client.contactName,
        },
      })),
      requests: searchResults.requests.map((request) => ({
        id: request.id,
        type: 'request' as const,
        title: request.subject,
        subtitle: `${request.client.name} • ${request.priority} priority`,
        status: request.status,
        createdAt: request.createdAt,
        url: `/requests/${request.id}`,
        metadata: {
          clientName: request.client.name,
          assignedTo: request.assignedTo?.name,
        },
      })),
      quotes: searchResults.quotes.map((quote) => ({
        id: quote.id,
        type: 'quote' as const,
        title: quote.quoteNumber,
        subtitle: `${quote.client.name} • ${quote._count.lineItems} items • $${quote.totalAmount.toLocaleString()}`,
        status: quote.status,
        createdAt: quote.createdAt,
        url: `/quotes/${quote.id}`,
        metadata: {
          clientName: quote.client.name,
          requestSubject: quote.request.subject,
          totalAmount: quote.totalAmount,
        },
      })),
      purchaseOrders: searchResults.purchaseOrders.map((po) => ({
        id: po.id,
        type: 'order' as const,
        title: po.poNumber,
        subtitle: `${po.client.name} • ${po._count.items} items • $${po.totalAmount.toLocaleString()}`,
        status: po.status,
        createdAt: po.receivedAt,
        url: `/orders/${po.id}`,
        metadata: {
          clientName: po.client.name,
          quoteNumber: po.quote?.quoteNumber ?? 'N/A',
          totalAmount: po.totalAmount,
        },
      })),
    }

    const totalResults = Object.values(transformedResults).reduce(
      (total, results) => total + results.length,
      0
    )

    return NextResponse.json({
      success: true,
      data: {
        ...transformedResults,
        totalResults,
        query,
      },
    })
  } catch (error) {
    console.error('Search GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
