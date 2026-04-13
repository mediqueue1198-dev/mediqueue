import { cn } from '@/utils/helpers'
import { Loader } from 'lucide-react'

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md',
  secondary: 'bg-surface-100 text-surface-700 hover:bg-surface-200 focus:ring-surface-400',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 focus:ring-danger-400',
  success: 'bg-medical-500 text-white hover:bg-medical-600 focus:ring-medical-400',
  ghost: 'text-surface-600 hover:bg-surface-100 focus:ring-surface-400',
  outline: 'border border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-400',
  warning: 'bg-warning-500 text-white hover:bg-warning-600 focus:ring-warning-400',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
  xl: 'px-8 py-4 text-lg rounded-2xl gap-3',
  icon: 'p-2.5 rounded-xl',
  'icon-sm': 'p-1.5 rounded-lg',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  iconRight,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 flex-shrink-0" />
      ) : null}
      {children}
      {iconRight && !isLoading && (
        <span className="flex-shrink-0">{iconRight}</span>
      )}
    </button>
  )
}

export default Button
