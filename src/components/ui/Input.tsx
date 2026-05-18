import React, { forwardRef } from 'react'
import { cn } from '@/utils/helpers'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ElementType;
  iconRight?: React.ReactNode;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  label,
  error,
  hint,
  icon: Icon,
  iconRight,
  className,
  inputClassName,
  required,
  ...props
}, ref) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-xl border bg-white text-surface-800 text-sm',
            'placeholder-surface-400 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:border-primary-500',
            error
              ? 'border-danger-400 focus:ring-danger-100 focus:border-danger-500'
              : 'border-surface-200 focus:ring-primary-100',
            Icon && 'pl-10',
            iconRight && 'pr-10',
            inputClassName,
          )}
          {...props}
        />
        {iconRight && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400">
            {iconRight}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-surface-500">{hint}</p>}
    </div>
  )
})

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({
  label,
  error,
  hint,
  className,
  required,
  rows = 3,
  ...props
}, ref) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl border bg-white text-surface-800 text-sm',
          'placeholder-surface-400 transition-all duration-200 resize-none',
          'focus:outline-none focus:ring-2 focus:border-primary-500',
          error
            ? 'border-danger-400 focus:ring-danger-100'
            : 'border-surface-200 focus:ring-primary-100',
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-surface-500">{hint}</p>}
    </div>
  )
})

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({
  label,
  error,
  hint,
  className,
  required,
  children,
  ...props
}, ref) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          'w-full px-3.5 py-2.5 rounded-xl border bg-white text-surface-800 text-sm',
          'transition-all duration-200 appearance-none cursor-pointer',
          'focus:outline-none focus:ring-2 focus:border-primary-500',
          error
            ? 'border-danger-400 focus:ring-danger-100'
            : 'border-surface-200 focus:ring-primary-100',
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1.5 text-xs text-danger-600">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-surface-500">{hint}</p>}
    </div>
  )
})

export default Input
