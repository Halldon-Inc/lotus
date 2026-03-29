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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'

    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { vendorName: { contains: search } },
        { contactName: { contains: search } },
        { contactEmail: { contains: search } },
      ]
    }

    const [vendors, total] = await Promise.all([
      prisma.vendorProfile.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortDirection },
        include: {
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.vendorProfile.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items: vendors,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('VendorProfiles GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER', 'PROCUREMENT'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const { vendorName, contactName, contactEmail, contactPhone, certifications, notes } = body

    if (!vendorName) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: vendorName' },
        { status: 400 }
      )
    }

    // Check for duplicate vendor name
    const existingVendor = await prisma.vendorProfile.findUnique({
      where: { vendorName },
    })

    if (existingVendor) {
      return NextResponse.json(
        { success: false, error: 'A vendor profile with this name already exists' },
        { status: 409 }
      )
    }

    const vendor = await prisma.vendorProfile.create({
      data: {
        vendorName,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        certifications: certifications || null,
        notes: notes || null,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'vendor_profile',
        entityId: vendor.id,
        action: 'created',
        details: JSON.stringify({
          vendorName: vendor.vendorName,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: vendor,
      message: 'Vendor profile created successfully',
    })
  } catch (error) {
    console.error('VendorProfiles POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
