'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertTriangle,
  MoreHorizontal,
  Package,
  ShoppingCart,
  Truck,
  CheckCircle,
  Clock,
  Eye,
} from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

export interface KanbanCard {
  id: string
  title: string
  subtitle?: string
  description?: string
  status: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  assignedTo?: string
  dueDate?: Date | string
  amount?: number
  tags?: string[]
  metadata?: Record<string, any>
  actions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: (card: KanbanCard) => void
    variant?: 'default' | 'destructive'
  }>
}

export interface KanbanColumn {
  id: string
  title: string
  status: string
  color?: string
  cards: KanbanCard[]
  limit?: number
}

export interface KanbanBoardProps {
  columns: KanbanColumn[]
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string) => void
  onCardClick?: (card: KanbanCard) => void
  className?: string
  enableDragDrop?: boolean
}

export function KanbanBoard({
  columns,
  onCardMove,
  onCardClick,
  className,
  enableDragDrop = true,
}: KanbanBoardProps) {
  const [draggedCard, setDraggedCard] = useState<KanbanCard | null>(null)
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null)

  const handleDragStart = (card: KanbanCard, columnId: string) => {
    if (!enableDragDrop) return
    setDraggedCard(card)
    setDraggedFrom(columnId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    if (!enableDragDrop || !draggedCard || !draggedFrom) return

    if (draggedFrom !== columnId) {
      onCardMove?.(draggedCard.id, draggedFrom, columnId)
    }

    setDraggedCard(null)
    setDraggedFrom(null)
  }

  const getPriorityColor = (priority: string | undefined) => {
    if (!priority) return ''
    const colors: Record<string, string> = {
      'LOW': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'URGENT': 'bg-red-100 text-red-800',
    }
    return colors[priority] || ''
  }

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      'PENDING': <Clock className="h-4 w-4 text-gray-500" />,
      'RECEIVED': <Package className="h-4 w-4 text-blue-500" />,
      'VERIFIED': <CheckCircle className="h-4 w-4 text-green-500" />,
      'IN_PURCHASING': <ShoppingCart className="h-4 w-4 text-purple-500" />,
      'PARTIALLY_FULFILLED': <Truck className="h-4 w-4 text-orange-500" />,
      'FULFILLED': <CheckCircle className="h-4 w-4 text-green-500" />,
      'DELIVERED': <CheckCircle className="h-4 w-4 text-emerald-500" />,
    }
    return icons[status] || <Package className="h-4 w-4 text-gray-500" />
  }

  const isOverdue = (dueDate: Date | string | undefined) => {
    if (!dueDate) return false
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
    return due < new Date()
  }

  return (
    <div className={cn('flex space-x-6 overflow-x-auto pb-4', className)}>
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex-shrink-0 w-80"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          {/* Column Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-foreground">{column.title}</h3>
                <Badge variant="secondary">{column.cards.length}</Badge>
                {column.limit && column.cards.length > column.limit && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
              {column.color && (
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: column.color }}
                />
              )}
            </div>
            <div className="w-full h-1 bg-muted rounded-full mt-2">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: column.limit 
                    ? `${Math.min((column.cards.length / column.limit) * 100, 100)}%`
                    : '0%',
                  backgroundColor: column.color || '#6366f1',
                  opacity: 0.7
                }}
              />
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-3 min-h-[200px]">
            {column.cards.map((card) => (
              <Card
                key={card.id}
                className={cn(
                  'cursor-pointer hover:shadow-md transition-shadow duration-200 border-l-4',
                  isOverdue(card.dueDate) && 'border-l-red-500 bg-red-50/50',
                  card.priority === 'URGENT' && 'border-l-red-500',
                  card.priority === 'HIGH' && 'border-l-orange-500',
                  card.priority === 'MEDIUM' && 'border-l-yellow-500',
                  card.priority === 'LOW' && 'border-l-green-500',
                  !card.priority && 'border-l-gray-300',
                  draggedCard?.id === card.id && 'opacity-50'
                )}
                draggable={enableDragDrop}
                onDragStart={() => handleDragStart(card, column.id)}
                onClick={() => onCardClick?.(card)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {card.title}
                      </CardTitle>
                      {card.subtitle && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {card.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      {getStatusIcon(card.status)}
                      {card.actions && card.actions.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {card.actions.map((action, index) => (
                              <DropdownMenuItem
                                key={index}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  action.onClick(card)
                                }}
                                className={action.variant === 'destructive' ? 'text-red-600' : ''}
                              >
                                {action.icon}
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {card.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {card.description}
                    </p>
                  )}

                  {/* Tags */}
                  {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {card.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      {card.priority && (
                        <Badge className={cn('text-xs px-1.5 py-0', getPriorityColor(card.priority))}>
                          {card.priority}
                        </Badge>
                      )}
                      {card.assignedTo && (
                        <span className="text-muted-foreground">
                          @{card.assignedTo}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {card.amount && (
                        <span className="font-medium">
                          {formatCurrency(card.amount)}
                        </span>
                      )}
                      {card.dueDate && (
                        <span className={cn(
                          'text-muted-foreground',
                          isOverdue(card.dueDate) && 'text-red-600 font-medium'
                        )}>
                          {formatDate(card.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {column.cards.length === 0 && (
              <div className="flex items-center justify-center h-32 border-2 border-dashed border-muted rounded-lg">
                <p className="text-sm text-muted-foreground">No items</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
