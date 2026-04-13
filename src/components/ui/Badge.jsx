import { cn } from '@/utils/helpers'

const variants = {
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-medical-100 text-medical-700',
  danger: 'bg-danger-100 text-danger-700',
  warning: 'bg-warning-100 text-warning-700',
  neutral: 'bg-surface-100 text-surface-600',
  purple: 'bg-purple-100 text-purple-700',
  cyan: 'bg-cyan-100 text-cyan-700',
}

const dotColors = {
  primary: 'bg-primary-500',
  success: 'bg-medical-500',
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  neutral: 'bg-surface-400',
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500',
}

export function Badge({ children, variant = 'neutral', dot = false, pulse = false, className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          dotColors[variant],
          pulse && 'animate-pulse',
        )} />
      )}
      {children}
    </span>
  )
}

export default Badge
