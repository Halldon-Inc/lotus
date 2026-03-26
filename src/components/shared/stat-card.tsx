import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'positive' | 'negative' | 'neutral'
  }
  icon?: React.ReactNode
  className?: string
}

export function StatCard({ title, value, change, icon, className }: StatCardProps) {
  return (
    <Card className={cn('stat-card', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="stat-card-title">{title}</p>
            <p className="stat-card-value">{value}</p>
            {change && (
              <p className={cn('stat-card-change', change.type)}>
                {change.type === 'positive' && '+'}
                {change.value}
                {typeof change.value === 'number' && change.value % 1 !== 0 ? '%' : ''}
              </p>
            )}
          </div>
          {icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
