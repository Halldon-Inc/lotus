'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SlidePanelProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  side?: 'left' | 'right'
  showOverlay?: boolean
  className?: string
  headerActions?: React.ReactNode
  footer?: React.ReactNode
}

const widthClasses = {
  sm: 'w-96',
  md: 'w-[28rem]',
  lg: 'w-[36rem]',
  xl: 'w-[48rem]',
  full: 'w-full',
}

export function SlidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'md',
  side = 'right',
  showOverlay = true,
  className,
  headerActions,
  footer,
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Focus management
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      {showOverlay && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 bottom-0 z-50 flex flex-col bg-background border-l shadow-xl transition-transform duration-300 ease-in-out focus:outline-none',
          widthClasses[width],
          side === 'right' ? 'right-0' : 'left-0 border-l-0 border-r',
          isOpen
            ? 'transform translate-x-0'
            : side === 'right'
            ? 'transform translate-x-full'
            : 'transform -translate-x-full',
          className
        )}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex-1 min-w-0">
            {title && (
              <h2 className="text-lg font-semibold text-foreground truncate">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-4">
            {headerActions}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t bg-muted/50">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

// Convenience wrapper for common use cases
export interface DetailPanelProps extends Omit<SlidePanelProps, 'children'> {
  data?: Record<string, any>
  fields?: Array<{
    key: string
    label: string
    render?: (value: any, data: Record<string, any>) => React.ReactNode
    section?: string
  }>
  sections?: Array<{
    title: string
    fields: string[]
  }>
  loading?: boolean
  error?: string
}

export function DetailPanel({
  data,
  fields = [],
  sections = [],
  loading = false,
  error,
  ...panelProps
}: DetailPanelProps) {
  const renderField = (field: any) => {
    const value = data?.[field.key]

    if (field.render) {
      return field.render(value, data || {})
    }

    if (value == null || value === '') {
      return <span className="text-muted-foreground italic">Not set</span>
    }

    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-600' : 'text-red-600'}>
        {value ? 'Yes' : 'No'}
      </span>
    }

    if (typeof value === 'number') {
      return <span className="font-mono">{value.toLocaleString()}</span>
    }

    if (value instanceof Date) {
      return <span>{value.toLocaleDateString()}</span>
    }

    if (Array.isArray(value)) {
      return <span>{value.join(', ')}</span>
    }

    return <span>{String(value)}</span>
  }

  let content

  if (loading) {
    content = (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  } else if (error) {
    content = (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      </div>
    )
  } else if (sections.length > 0) {
    // Render with sections
    content = (
      <div className="p-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-foreground mb-3 pb-1 border-b">
              {section.title}
            </h3>
            <div className="space-y-3">
              {section.fields.map((fieldKey) => {
                const field = fields.find(f => f.key === fieldKey)
                if (!field) return null

                return (
                  <div key={field.key} className="flex justify-between items-start">
                    <div className="text-sm font-medium text-muted-foreground min-w-0 w-1/3">
                      {field.label}:
                    </div>
                    <div className="text-sm text-foreground flex-1 min-w-0 text-right">
                      {renderField(field)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  } else {
    // Render fields directly
    content = (
      <div className="p-4 space-y-3">
        {fields.map((field) => (
          <div key={field.key} className="flex justify-between items-start">
            <div className="text-sm font-medium text-muted-foreground min-w-0 w-1/3">
              {field.label}:
            </div>
            <div className="text-sm text-foreground flex-1 min-w-0 text-right">
              {renderField(field)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <SlidePanel {...panelProps}>
      {content}
    </SlidePanel>
  )
}
