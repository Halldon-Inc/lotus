import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateDiscrepancySchema } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const discrepancy = await prisma.discrepancy.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                type: true,
                contactName: true,
                contactEmail: true,
              },
            },
            items: {
              include: {
                quoteLineItem: {
                  select: {
                    productName: true,
                    description: true,
                    quantity: true,
                    unitPrice: true,
                  },
                },
              },
            },
          },
        },
        purchaseOrderItem: {
          include: {
            quoteLineItem: {
              select: {
                productName: true,
                description: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        },
        invoice: {
          include: {
            lineItems: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    if (!discrepancy) {
      return NextResponse.json(
        { success: false, error: 'Discrepancy not found' },
        { status: 404 }
      )
    }

    // Parse photoUrls from JSON string
    const parsedPhotoUrls = discrepancy.photoUrls
      ? JSON.parse(discrepancy.photoUrls)
      : []

    return NextResponse.json({
      success: true,
      data: {
        ...discrepancy,
        parsedPhotoUrls,
      },
    })
  } catch (error) {
    console.error('Discrepancy GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'OPERATIONS', 'PROCUREMENT'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateDiscrepancySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existingDiscrepancy = await prisma.discrepancy.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          select: { poNumber: true },
        },
      },
    })

    if (!existingDiscrepancy) {
      return NextResponse.json(
        { success: false, error: 'Discrepancy not found' },
        { status: 404 }
      )
    }

    const data = validation.data
    const isResolving = data.status === 'RESOLVED' && existingDiscrepancy.status !== 'RESOLVED'
    const isEscalating = data.status === 'ESCALATED' && existingDiscrepancy.status !== 'ESCALATED'

    const updateData: Record<string, unknown> = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes
    if (data.photoUrls !== undefined) updateData.photoUrls = JSON.stringify(data.photoUrls)

    if (isResolving) {
      updateData.resolvedById = session.user.id
      updateData.resolvedAt = new Date()
    }

    const discrepancy = await prisma.discrepancy.update({
      where: { id },
      data: updateData,
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Alert the reporter on resolution
    if (isResolving) {
      await prisma.alert.create({
        data: {
          userId: discrepancy.reportedBy.id,
          type: 'SYSTEM',
          title: 'Discrepancy resolved',
          message: `The ${discrepancy.type.replace(/_/g, ' ').toLowerCase()} for PO ${discrepancy.purchaseOrder.poNumber} has been resolved by ${session.user.name || 'a team member'}`,
          relatedEntityType: 'discrepancy',
          relatedEntityId: discrepancy.id,
          severity: 'INFO',
        },
      })
    }

    // Alert managers on escalation
    if (isEscalating) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      })

      await Promise.all(
        admins.map((admin) =>
          prisma.alert.create({
            data: {
              userId: admin.id,
              type: 'ATTENTION_REQUIRED',
              title: 'Discrepancy escalated',
              message: `A ${discrepancy.type.replace(/_/g, ' ').toLowerCase()} for PO ${discrepancy.purchaseOrder.poNumber} has been escalated and requires admin attention`,
              relatedEntityType: 'discrepancy',
              relatedEntityId: discrepancy.id,
              severity: 'CRITICAL',
            },
          })
        )
      )
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'discrepancy',
        entityId: discrepancy.id,
        action: isResolving ? 'resolved' : isEscalating ? 'escalated' : 'updated',
        details: JSON.stringify({
          type: discrepancy.type,
          poNumber: discrepancy.purchaseOrder.poNumber,
          previousStatus: existingDiscrepancy.status,
          newStatus: data.status || existingDiscrepancy.status,
          resolutionNotes: data.resolutionNotes,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: discrepancy,
      message: isResolving
        ? 'Discrepancy resolved successfully'
        : isEscalating
          ? 'Discrepancy escalated successfully'
          : 'Discrepancy updated successfully',
    })
  } catch (error) {
    console.error('Discrepancy PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
