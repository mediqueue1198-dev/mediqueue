import { cn } from '@/utils/helpers'
import Button from './Button'

export function EmptyState({ icon: Icon, title, description, action, actionLabel, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-surface-400" />
        </div>
      )}
      <h3 className="text-base font-semibold text-surface-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-surface-500 max-w-xs">{description}</p>}
      {action && (
        <Button onClick={action} size="sm" className="mt-4">
          {actionLabel || 'Take Action'}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
