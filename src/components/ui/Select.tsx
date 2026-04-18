import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface Option {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  icon?: React.ElementType;
  className?: string;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  error,
  icon: Icon,
  className
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn("space-y-1.5", className)} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full h-14 px-5 flex items-center gap-3 bg-surface-50 border-2 rounded-2xl transition-all duration-300 text-left outline-none",
            isOpen ? "border-primary-500 bg-white ring-4 ring-primary-500/10" : "border-surface-100 hover:border-surface-200",
            error ? "border-danger-500 bg-danger-50/30" : ""
          )}
        >
          {Icon && <Icon className={cn("w-5 h-5", isOpen ? "text-primary-500" : "text-surface-400")} />}
          
          <span className={cn(
            "flex-1 text-sm font-medium truncate",
            selectedOption ? "text-surface-900" : "text-surface-400"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          
          <ChevronDown className={cn(
            "w-4 h-4 text-surface-400 transition-transform duration-300",
            isOpen ? "rotate-180 text-primary-500" : ""
          )} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl border border-surface-100 shadow-2xl overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-200 origin-top">
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full px-5 py-3 text-left text-sm font-medium flex items-center justify-between transition-colors",
                    option.value === value 
                      ? "bg-primary-50 text-primary-700" 
                      : "text-surface-600 hover:bg-surface-50"
                  )}
                >
                  {option.label}
                  {option.value === value && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {error && <p className="text-[11px] font-bold text-danger-500 ml-1">{error}</p>}
    </div>
  )
}
