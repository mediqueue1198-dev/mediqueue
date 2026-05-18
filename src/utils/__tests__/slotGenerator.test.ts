import { describe, it, expect } from 'vitest';
import { generateSlots } from '../slotGenerator';
import { Doctor } from '../../types/queue';

describe('Slot Generator', () => {
  const mockDoctor: Doctor = {
    id: 'doc1',
    user_id: 'u1',
    specialization: 'General',
    consultation_avg_time: 15,
    is_available: true,
    availability_schedule: {
      monday: {
        active: true,
        start: '09:00',
        end: '12:00',
        break_start: '10:30',
        break_end: '11:00',
      }
    }
  };

  it('should generate slots for a working day', () => {
    // 2026-04-20 is a Monday
    const date = new Date('2026-04-20');
    const slots = generateSlots(mockDoctor, date);
    
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].timeFormatted).toBe('09:00 AM');
  });

  it('should skip slots during break time', () => {
    const date = new Date('2026-04-20');
    const slots = generateSlots(mockDoctor, date);
    
    // Break is 10:30 to 11:00. 
    // Slots are 15+5=20 mins.
    // 09:00, 09:20, 09:40, 10:00, 10:20 (ends 10:40 - overlaps break?)
    // Actually the logic skips if current is in break.
    
    const breakSlot = slots.find(s => s.timeFormatted === '10:40 AM');
    // If logic works, the 10:20 slot might be allowed if it starts before break?
    // Let's check 10:40 AM specifically.
    const times = slots.map(s => s.timeFormatted);
    expect(times).not.toContain('10:40 AM');
    expect(times).toContain('11:00 AM');
  });

  it('should mark booked slots as unavailable', () => {
    const date = new Date('2026-04-20');
    const existingAppointments: any[] = [
      { scheduled_time: new Date('2026-04-20T09:00:00').toISOString() }
    ];
    
    const slots = generateSlots(mockDoctor, date, existingAppointments);
    const firstSlot = slots.find(s => s.timeFormatted === '09:00 AM');
    
    expect(firstSlot?.available).toBe(false);
    expect(firstSlot?.isBooked).toBe(true);
  });
});
