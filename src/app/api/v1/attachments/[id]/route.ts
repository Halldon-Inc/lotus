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

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: attachment,
    })
  } catch (error) {
    console.error('Attachment GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    })

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      )
    }

    // Only ADMIN, MANAGER, or the original uploader can delete
    const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(session.user.role)
    const isUploader = attachment.uploadedById === session.user.id

    if (!isAdminOrManager && !isUploader) {
      return NextResponse.json(
        { success: false, error: 'Only admins, managers, or the uploader can delete attachments' },
        { status: 403 }
      )
    }

    await prisma.attachment.delete({
      where: { id },
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: attachment.entityType.toLowerCase(),
        entityId: attachment.entityId,
        action: 'attachment_deleted',
        details: JSON.stringify({
          attachmentId: id,
          fileName: attachment.fileName,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Attachment deleted successfully',
    })
  } catch (error) {
    console.error('Attachment DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
