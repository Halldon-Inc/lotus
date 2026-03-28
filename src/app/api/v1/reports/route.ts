import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'client-spending'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Default to current fiscal year if no dates provided
    const defaultStartDate = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 3, 1) // April 1st
    const defaultEndDate = endDate ? new Date(endDate) : new Date(new Date().getFullYear() + 1, 2, 31) // March 31st

    let reportData: Record<string, unknown> = {}

    switch (reportType) {
      case 'client-spending':
        // Client spending vs fiscal year limits
        const clients = await prisma.client.findMany({
          include: {
            purchaseOrders: {
              where: {
                receivedAt: {
                  gte: defaultStartDate,
                  lte: defaultEndDate,
                },
              },
              select: {
                totalAmount: true,
                receivedAt: true,
                status: true,
              },
            },
            assignedRep: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        reportData.clientSpending = clients.map(client => {
          const totalSpent = client.purchaseOrders.reduce(
            (sum, po) => sum + po.totalAmount,
            0
          )
          const orderCount = client.purchaseOrders.length
          const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0

          return {
            clientId: client.id,
            clientName: client.name,
            clientType: client.type,
            assignedRep: client.assignedRep?.name || 'Unassigned',
            totalSpent,
            orderCount,
            averageOrderValue,
            spendingLimit: client.spendingLimit,
            utilizationRate: client.spendingLimit ? (totalSpent / client.spendingLimit) * 100 : null,
            isOverLimit: client.spendingLimit ? totalSpent > client.spendingLimit : false,
          }
        }).sort((a, b) => b.totalSpent - a.totalSpent)

        break

      case 'rep-performance':
        // Rep performance metrics
        const reps = await prisma.user.findMany({
          where: {
            role: { in: ['SALES', 'MANAGER'] },
            isActive: true,
          },
          include: {
            assignedRequests: {
              where: {
                createdAt: {
                  gte: defaultStartDate,
                  lte: defaultEndDate,
                },
              },
              include: {
                quotes: {
                  include: {
                    purchaseOrder: {
                      select: {
                        totalAmount: true,
                        items: {
                          select: {
                            status: true,
                            expectedDeliveryDate: true,
                            receivedAt: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })

        reportData.repPerformance = reps.map(rep => {
          const requests = rep.assignedRequests
          const totalRequests = requests.length
          const completedRequests = requests.filter(r => r.status === 'CLOSED').length
          const quotedRequests = requests.filter(r => r.status === 'QUOTED').length
          
          const totalRevenue = requests.reduce((sum, request) => {
            return sum + request.quotes.reduce((quoteSum, quote) => {
              return quoteSum + (quote.purchaseOrder?.totalAmount || 0)
            }, 0)
          }, 0)

          const totalOrders = requests.reduce((sum, request) => {
            return sum + request.quotes.filter(q => q.purchaseOrder).length
          }, 0)

          // Calculate average resolution time (request creation to closed)
          const resolvedRequests = requests.filter(r => r.status === 'CLOSED')
          const avgResolutionTime = resolvedRequests.length > 0 
            ? resolvedRequests.reduce((sum, request) => {
                const createdAt = new Date(request.createdAt)
                const updatedAt = new Date(request.updatedAt)
                return sum + (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24) // days
              }, 0) / resolvedRequests.length
            : 0

          // Calculate missing item rate
          const allItems = requests.flatMap(r => 
            r.quotes.flatMap(q => q.purchaseOrder?.items || [])
          )
          const missingItems = allItems.filter(item => item.status === 'MISSING')
          const missingItemRate = allItems.length > 0 ? (missingItems.length / allItems.length) * 100 : 0

          return {
            userId: rep.id,
            userName: rep.name || rep.email,
            totalRequests,
            completedRequests,
            quotedRequests,
            totalOrders,
            totalRevenue,
            averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            averageResolutionTime: Math.round(avgResolutionTime * 10) / 10,
            missingItemRate: Math.round(missingItemRate * 10) / 10,
            conversionRate: totalRequests > 0 ? (quotedRequests / totalRequests) * 100 : 0,
          }
        }).sort((a, b) => b.totalRevenue - a.totalRevenue)

        break

      case 'pipeline-analytics':
        // Pipeline analytics
        const pipelineStats = await prisma.request.groupBy({
          by: ['status'],
          where: {
            createdAt: {
              gte: defaultStartDate,
              lte: defaultEndDate,
            },
          },
          _count: {
            id: true,
          },
        })

        const monthlyData = []
        const currentDate = new Date()
        
        for (let i = 11; i >= 0; i--) {
          const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0)
          
          const [requests, quotes, orders] = await Promise.all([
            prisma.request.count({
              where: {
                createdAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              },
            }),
            prisma.quote.count({
              where: {
                createdAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              },
            }),
            prisma.purchaseOrder.count({
              where: {
                receivedAt: {
                  gte: monthStart,
                  lte: monthEnd,
                },
              },
            }),
          ])

          monthlyData.push({
            month: monthStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
            requests,
            quotes,
            orders,
          })
        }

        reportData.pipelineAnalytics = {
          statusBreakdown: pipelineStats.reduce((acc, stat) => {
            acc[stat.status] = stat._count.id
            return acc
          }, {} as Record<string, number>),
          monthlyTrends: monthlyData,
        }

        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid report type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: {
        reportType,
        dateRange: {
          startDate: defaultStartDate.toISOString(),
          endDate: defaultEndDate.toISOString(),
        },
        generatedAt: new Date().toISOString(),
        ...reportData,
      },
    })
  } catch (error) {
    console.error('Reports GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
