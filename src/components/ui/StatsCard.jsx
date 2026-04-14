import { Card } from '@/components/ui/Card'
import { cn } from '@/utils/helpers'
import { Link } from 'react-router-dom'

export function StatsCard({ title, value, subtitle, icon: Icon, trend, trendLabel, color = 'primary', className, glass = false, to, onClick }) {
  const colorMap = {
    primary: {
      bg: 'bg-primary-50',
      icon: 'bg-primary-100 text-primary-600',
      value: 'text-primary-700',
      trend: { up: 'text-medical-600', down: 'text-danger-600' },
    },
    success: {
      bg: 'bg-medical-50',
      icon: 'bg-medical-100 text-medical-600',
      value: 'text-medical-700',
      trend: { up: 'text-medical-600', down: 'text-danger-600' },
    },
    danger: {
      bg: 'bg-danger-50',
      icon: 'bg-danger-100 text-danger-600',
      value: 'text-danger-700',
      trend: { up: 'text-medical-600', down: 'text-danger-600' },
    },
    warning: {
      bg: 'bg-warning-50',
      icon: 'bg-warning-100 text-warning-600',
      value: 'text-warning-700',
      trend: { up: 'text-medical-600', down: 'text-danger-600' },
    },
    neutral: {
      bg: 'bg-surface-50',
      icon: 'bg-surface-100 text-surface-600',
      value: 'text-surface-700',
      trend: { up: 'text-medical-600', down: 'text-danger-600' },
    },
  }

  const c = colorMap[color] || colorMap.primary

  const content = (
    <Card 
      glass={glass} 
      hover={glass || !!to || !!onClick} 
      className={cn('h-full p-5 border-none shadow-soft transition-all duration-300', className)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-2">{title}</p>
          <p className={cn('text-3xl font-bold font-display', c.value)}>{value}</p>
          {subtitle && <p className="text-xs text-surface-500 mt-1 font-medium italic">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-md bg-white/50 backdrop-blur-sm', trend >= 0 ? c.trend.up : c.trend.down)}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="text-[10px] text-surface-400 font-medium">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner', c.icon)}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </Card>
  )

  if (to) {
    return <Link to={to} className="block w-full h-full">{content}</Link>
  }
  return content
}

export default StatsCard
