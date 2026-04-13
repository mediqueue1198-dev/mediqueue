import { cn, getInitials, generateAvatarColor } from '@/utils/helpers'

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl',
}

export function Avatar({ name, src, size = 'md', className, online, ...props }) {
  const initials = getInitials(name)
  const colorClass = generateAvatarColor(name)

  return (
    <div className={cn('relative flex-shrink-0', className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover', sizes[size])}
        />
      ) : (
        <div className={cn(
          'rounded-full flex items-center justify-center font-semibold font-display',
          sizes[size],
          colorClass,
        )}>
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span className={cn(
          'absolute bottom-0 right-0 block rounded-full ring-2 ring-white',
          size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5',
          online ? 'bg-medical-500' : 'bg-surface-300',
        )} />
      )}
    </div>
  )
}

export default Avatar
