import { cn } from '@/utils/helpers'

export function Card({ children, className, hover = false, glass = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-300',
        !glass && 'bg-white shadow-soft border-surface-100',
        glass && 'bg-white/70 backdrop-blur-md border-white/20 shadow-xl',
        hover && 'hover:shadow-lg hover:-translate-y-1 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('px-5 py-4 border-b border-surface-100', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn('font-semibold text-surface-800 font-display', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardBody({ children, className, ...props }) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div className={cn('px-5 py-3 border-t border-surface-100 bg-surface-50 rounded-b-2xl', className)} {...props}>
      {children}
    </div>
  )
}

export default Card
