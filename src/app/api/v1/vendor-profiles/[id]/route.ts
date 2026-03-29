import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    const vendor = await prisma.vendorProfile.findUnique({
      where: { id },
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Vendor profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: vendor,
    })
  } catch (error) {
    console.error('VendorProfile GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const existing = await prisma.vendorProfile.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Vendor profile not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.contactName !== undefined) updateData.contactName = body.contactName
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone
    if (body.w9Status !== undefined) updateData.w9Status = body.w9Status
    if (body.w9FileUrl !== undefined) updateData.w9FileUrl = body.w9FileUrl
    if (body.insuranceExpiry !== undefined) updateData.insuranceExpiry = new Date(body.insuranceExpiry)
    if (body.insuranceFileUrl !== undefined) updateData.insuranceFileUrl = body.insuranceFileUrl
    if (body.certifications !== undefined) updateData.certifications = body.certifications
    if (body.notes !== undefined) updateData.notes = body.notes

    // Handle status changes with approval tracking
    if (body.status !== undefined) {
      updateData.status = body.status
      if (body.status === 'APPROVED') {
        updateData.approvedById = session.user.id
        updateData.approvedAt = new Date()
      }
    }

    const vendor = await prisma.vendorProfile.update({
      where: { id },
      data: updateData,
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'vendor_profile',
        entityId: vendor.id,
        action: 'updated',
        details: JSON.stringify({
          vendorName: vendor.vendorName,
          changes: Object.keys(updateData),
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: vendor,
      message: 'Vendor profile updated successfully',
    })
  } catch (error) {
    console.error('VendorProfile PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
