import { cn } from '@/utils/helpers'

export function LoadingSpinner({ size = 'md', className, label }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12', xl: 'w-16 h-16' }
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <svg className={cn('animate-spin text-primary-600', sizes[size])} viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {label && <p className="text-sm text-surface-500">{label}</p>}
    </div>
  )
}

export function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}

export default LoadingSpinner
