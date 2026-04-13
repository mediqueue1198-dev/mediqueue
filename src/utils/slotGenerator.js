/**
 * Smart Appointment Slot Generator
 * Dynamically generates available time slots based on doctor schedule and queue load
 */

import { addMinutes, format, parse, isAfter, isBefore, isSameDay } from 'date-fns'

const SLOT_BUFFER = 5 // minutes between slots

/**
 * Generate appointment slots for a given doctor and date
 * @param {Object} doctor - Doctor object with availability_schedule and consultation_avg_time
 * @param {Date} date - Target date
 * @param {Array} existingAppointments - Already booked appointments for that day
 * @returns {Array} Available slots with metadata
 */
export function generateSlots(doctor, date, existingAppointments = [], locationId = null) {
  const dayName = format(date, 'EEEE').toLowerCase()
  
  let schedule = null
  // Handle new multi-location array model
  if (Array.isArray(doctor.availability_schedule)) {
    if (locationId) {
      const loc = doctor.availability_schedule.find(l => l.id === locationId)
      schedule = loc?.schedule?.[dayName]
    } else {
      // If no location provided, we can't generate specific slots
      return []
    }
  } else {
    // Handle legacy flat object model
    schedule = doctor.availability_schedule?.[dayName]
  }

  if (!schedule || !schedule.active) return []

  const startTime = parse(schedule.start, 'HH:mm', date)
  const endTime = parse(schedule.end, 'HH:mm', date)
  const slotDuration = (doctor.consultation_avg_time || 15) + SLOT_BUFFER

  let breakStart = null
  let breakEnd = null
  if (schedule.break_start && schedule.break_end) {
    breakStart = parse(schedule.break_start, 'HH:mm', date)
    breakEnd = parse(schedule.break_end, 'HH:mm', date)
  }

  const slots = []
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

/**
 * Get recommended slots (best available based on low wait time)
 * @param {Array} slots - All generated slots
 * @param {number} count - Number of recommendations
 * @returns {Array} Recommended slots
 */
export function getRecommendedSlots(slots, count = 3) {
  return slots
    .filter(s => s.available)
    .slice(0, count)
    .map((s, i) => ({
      ...s,
      isRecommended: i === 0,
      recommendLabel: i === 0 ? 'Best Available' : i === 1 ? 'Good Choice' : null,
    }))
}

/**
 * Check if a specific time slot is available
 */
export function isSlotAvailable(doctor, date, time, existingAppointments) {
  const slots = generateSlots(doctor, date, existingAppointments)
  const timeStr = format(time, 'hh:mm a')
  return slots.find(s => s.timeFormatted === timeStr)?.available ?? false
}

/**
 * Generate multi-doctor slot comparison for load balancing UI
 */
export function compareDoctoSlots(doctors, date, appointmentsByDoctor) {
  return doctors.map(doctor => {
    const existing = appointmentsByDoctor[doctor.id] || []
    const slots = generateSlots(doctor, date, existing)
    const availableCount = slots.filter(s => s.available).length
    const nextAvailable = slots.find(s => s.available)

    return {
      doctor,
      availableSlots: availableCount,
      totalSlots: slots.length,
      nextAvailableTime: nextAvailable?.timeFormatted || null,
      utilizationPercent: slots.length > 0
        ? Math.round(((slots.length - availableCount) / slots.length) * 100)
        : 0,
    }
  }).sort((a, b) => b.availableSlots - a.availableSlots)
}
