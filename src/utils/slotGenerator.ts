/**
 * Smart Appointment Slot Generator
 * Dynamically generates available time slots based on doctor schedule and queue load
 */

import { addMinutes, format, parse, isAfter, isBefore, isSameDay } from 'date-fns'
import { Doctor } from '../types/queue'
import { Appointment } from '../types/appointments'

const SLOT_BUFFER = 5 // minutes between slots

interface Slot {
  time: Date;
  timeFormatted: string;
  available: boolean;
  isBooked: boolean;
  isRecommended?: boolean;
  recommendLabel?: string | null;
}

/**
 * Generate appointment slots for a given doctor and date
 */
export function generateSlots(
  doctor: Doctor, 
  date: Date, 
  existingAppointments: Appointment[] = [], 
  locationId: string | null = null
): Slot[] {
  const dayName = format(date, 'EEEE').toLowerCase()
  
  let schedule: any = null
  if (Array.isArray(doctor.availability_schedule)) {
    if (locationId) {
      const loc = doctor.availability_schedule.find(l => l.id === locationId)
      schedule = loc?.schedule?.[dayName]
    } else {
      return []
    }
  } else {
    schedule = (doctor.availability_schedule as any)?.[dayName]
  }

  if (!schedule || !schedule.active) return []

  const startTime = parse(schedule.start, 'HH:mm', date)
  const endTime = parse(schedule.end, 'HH:mm', date)
  const slotDuration = (doctor.consultation_avg_time || 15) + SLOT_BUFFER

  let breakStart: Date | null = null
  let breakEnd: Date | null = null
  if (schedule.break_start && schedule.break_end) {
    breakStart = parse(schedule.break_start, 'HH:mm', date)
    breakEnd = parse(schedule.break_end, 'HH:mm', date)
  }

  const slots: Slot[] = []
  let current = startTime
  const now = new Date()

  while (isBefore(addMinutes(current, slotDuration), endTime)) {
    const slotEnd = addMinutes(current, slotDuration)

    // Skip slots during break time
    if (breakStart && breakEnd) {
      const slotOverlapsBreak = 
        (isAfter(current, breakStart) || current.getTime() === breakStart.getTime()) && 
        isBefore(current, breakEnd)
      
      if (slotOverlapsBreak) {
        current = breakEnd
        continue
      }
    }

    // Skip past slots
    if (isSameDay(date, now) && isBefore(current, addMinutes(now, 15))) {
      current = addMinutes(current, slotDuration)
      continue
    }

    // Check if slot conflicts with existing appointment
    const isBooked = existingAppointments.some(appt => {
      const apptTime = new Date(appt.scheduled_time)
      const apptEnd = addMinutes(apptTime, doctor.consultation_avg_time || 15)
      return (
        (isAfter(current, apptTime) && isBefore(current, apptEnd)) ||
        (isAfter(slotEnd, apptTime) && isBefore(slotEnd, apptEnd)) ||
        (isBefore(current, apptTime) && isAfter(slotEnd, apptEnd)) ||
        (current.getTime() === apptTime.getTime())
      )
    })

    slots.push({
      time: new Date(current),
      timeFormatted: format(current, 'hh:mm a'),
      available: !isBooked,
      isBooked,
    })

    current = addMinutes(current, slotDuration)
  }

  return slots
}

export function getRecommendedSlots(slots: Slot[], count: number = 3): Slot[] {
  return slots
    .filter(s => s.available)
    .slice(0, count)
    .map((s, i) => ({
      ...s,
      isRecommended: i === 0,
      recommendLabel: i === 0 ? 'Best Available' : i === 1 ? 'Good Choice' : null,
    }))
}

export function isSlotAvailable(doctor: Doctor, date: Date, time: Date, existingAppointments: Appointment[]): boolean {
  const slots = generateSlots(doctor, date, existingAppointments)
  const timeStr = format(time, 'hh:mm a')
  return slots.find(s => s.timeFormatted === timeStr)?.available ?? false
}
