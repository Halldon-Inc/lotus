import { calculateAging, formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AgingIndicatorProps {
  date: Date | string
  expectedDate?: Date | string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function AgingIndicator({
  date,
  expectedDate,
  showText = false,
  size = 'md',
  className
}: AgingIndicatorProps) {
  const aging = calculateAging(date, expectedDate)
  
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }

  const textColorClasses = {
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    red: 'text-red-700',
  }

  const pillClasses = {
    green: 'age-green',
    yellow: 'age-yellow',
    red: 'age-red',
  }

  if (showText) {
    return (
      <div className={cn('age-indicator', pillClasses[aging], className)}>
        <div className={cn('rounded-full mr-1.5', sizeClasses[size], colorClasses[aging])} />
        <span className={cn(textSizeClasses[size], textColorClasses[aging])}>
          {formatRelativeTime(date)}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-full',
        sizeClasses[size],
        colorClasses[aging],
        className
      )}
      title={`Last updated: ${formatRelativeTime(date)}`}
    />
  )
}
