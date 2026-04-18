import { format, formatDistanceToNow, isToday, isTomorrow, parseISO, isValid } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─── TAILWIND HELPER ──────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── DATE FORMATTERS ──────────────────────────────────────────────────────────
export function formatDate(date: string | Date | null | undefined, fmt: string = 'MMM dd, yyyy'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d!, fmt)
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d!, 'hh:mm a')
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  if (isToday(d!)) return `Today, ${format(d!, 'hh:mm a')}`
  if (isTomorrow(d!)) return `Tomorrow, ${format(d!, 'hh:mm a')}`
  return format(d!, 'MMM dd, yyyy hh:mm a')
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return formatDistanceToNow(d!, { addSuffix: true })
}

export function formatAge(dateOfBirth: string | Date | null | undefined): number | string {
  if (!dateOfBirth) return '—'
  const d = typeof dateOfBirth === 'string' ? parseISO(dateOfBirth) : dateOfBirth
  if (!isValid(d)) return '—'
  const today = new Date()
  const age = today.getFullYear() - d!.getFullYear()
  const m = today.getMonth() - d!.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d!.getDate())) return age - 1
  return age
}

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
export const QUEUE_STATUS_CONFIG: Record<string, { label: string, color: any, dot: string }> = {
  waiting: { label: 'Waiting', color: 'warning', dot: 'bg-warning-400' },
  in_consultation: { label: 'In Consultation', color: 'primary', dot: 'bg-primary-500 animate-pulse' },
  completed: { label: 'Completed', color: 'success', dot: 'bg-medical-500' },
  skipped: { label: 'Skipped', color: 'neutral', dot: 'bg-surface-400' },
  no_show: { label: 'No Show', color: 'danger', dot: 'bg-danger-400' },
  cancelled: { label: 'Cancelled', color: 'danger', dot: 'bg-danger-300' },
}

export const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string, color: any }> = {
  pending: { label: 'Pending', color: 'warning' },
  confirmed: { label: 'Confirmed', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'danger' },
  no_show: { label: 'No Show', color: 'danger' },
}

export const VISIT_TYPE_CONFIG: Record<string, { label: string, color: any }> = {
  first_visit: { label: 'First Visit', color: 'primary' },
  follow_up: { label: 'Follow Up', color: 'success' },
  emergency: { label: 'Emergency', color: 'danger' },
  walk_in: { label: 'Walk-in', color: 'warning' },
}

export const QUEUE_TYPE_CONFIG: Record<string, { label: string, icon: string }> = {
  appointment: { label: 'Appointment', icon: '📅' },
  walk_in: { label: 'Walk-in', icon: '🚶' },
  emergency: { label: 'Emergency', icon: '🚨' },
}

// ─── ROLE HELPERS ─────────────────────────────────────────────────────────────
export const ROLE_CONFIG: Record<string, { label: string, color: any, redirect: string }> = {
  patient: { label: 'Patient', color: 'primary', redirect: '/patient' },
  doctor: { label: 'Doctor', color: 'medical', redirect: '/doctor' },
  mediator: { label: 'Staff', color: 'warning', redirect: '/mediator' },
}

export function getRoleRedirect(role: string): string {
  return ROLE_CONFIG[role]?.redirect || '/login'
}

// ─── MISC HELPERS ─────────────────────────────────────────────────────────────
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function truncate(str: string | null | undefined, len: number = 80): string {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

export function generateAvatarColor(name: string | null | undefined): string {
  const colors = [
    'bg-primary-100 text-primary-700',
    'bg-medical-100 text-medical-700',
    'bg-warning-100 text-warning-700',
    'bg-danger-100 text-danger-700',
    'bg-purple-100 text-purple-700',
    'bg-cyan-100 text-cyan-700',
  ]
  if (!name) return colors[0]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  return phone
}

export function parseAllergyString(str: string | null | undefined): string[] {
  if (!str || !str.trim()) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

export function allergiesToString(arr: string[] | null | undefined): string {
  if (!arr || !arr.length) return ''
  return arr.join(', ')
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function safeJsonParse(str: string, fallback: any = null): any {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

// ─── SPECIALTY ICONS ──────────────────────────────────────────────────────────
export const SPECIALTY_ICONS: Record<string, string> = {
  'Cardiology': '❤️',
  'General Medicine': '🩺',
  'Orthopedics': '🦴',
  'Neurology': '🧠',
  'Dermatology': '🔬',
  'Pediatrics': '👶',
  'Ophthalmology': '👁️',
  'ENT': '👂',
  'Psychiatry': '🧘',
  'Oncology': '🎗️',
}

export function getSpecialtyIcon(specialty: string): string {
  return SPECIALTY_ICONS[specialty] || '🏥'
}
