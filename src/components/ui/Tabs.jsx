import { cn } from '@/utils/helpers'

export function Tabs({ tabs, activeTab, onChange, className }) {
  return (
    <div className={cn('flex gap-1 p-1 bg-surface-100 rounded-xl', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-white text-surface-800 shadow-sm'
              : 'text-surface-500 hover:text-surface-700',
          )}
        >
          {tab.icon && <tab.icon className="w-4 h-4" />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold',
              activeTab === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'bg-surface-200 text-surface-600',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export default Tabs
