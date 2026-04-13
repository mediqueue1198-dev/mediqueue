import { describe, it, expect } from 'vitest'
import {
  predictConsultationTime,
  calculateEstimatedWaitSync,
  formatWaitTime,
  getExpectedConsultationTime,
} from '../utils/timeEstimator'

describe('Time Estimator', () => {
  describe('predictConsultationTime', () => {
    it('uses doctor average as base', async () => {
      const time = await predictConsultationTime({
        doctorAvgTime: 20,
        visitType: 'follow_up',
        symptomsCount: 1,
        isNewPatient: false,
        patientsSeenToday: 0,
      })
      expect(time).toBe(20)
    })

    it('applies first_visit multiplier (1.5x)', async () => {
      const followUp = await predictConsultationTime({ doctorAvgTime: 20, visitType: 'follow_up' })
      const firstVisit = await predictConsultationTime({ doctorAvgTime: 20, visitType: 'first_visit' })
      expect(firstVisit).toBeGreaterThan(followUp)
    })

    it('adds new patient penalty', async () => {
      const returning = await predictConsultationTime({ doctorAvgTime: 15, isNewPatient: false })
      const newPatient = await predictConsultationTime({ doctorAvgTime: 15, isNewPatient: true })
      expect(newPatient).toBeGreaterThan(returning)
    })

    it('adds symptom complexity bonus', async () => {
      const simple = await predictConsultationTime({ doctorAvgTime: 15, symptomsCount: 1 })
      const complex = await predictConsultationTime({ doctorAvgTime: 15, symptomsCount: 8 })
      expect(complex).toBeGreaterThan(simple)
    })

    it('applies fatigue factor for high patient count', async () => {
      const fresh = await predictConsultationTime({ doctorAvgTime: 15, patientsSeenToday: 0 })
      const tired = await predictConsultationTime({ doctorAvgTime: 15, patientsSeenToday: 20 })
      expect(tired).toBeGreaterThan(fresh)
    })

    it('returns at least 5 minutes', async () => {
      const time = await predictConsultationTime({ doctorAvgTime: 1, visitType: 'emergency' })
      expect(time).toBeGreaterThanOrEqual(5)
    })
  })

  describe('calculateEstimatedWaitSync', () => {
    it('returns 0 for empty queue', () => {
      expect(calculateEstimatedWaitSync([])).toBe(0)
      expect(calculateEstimatedWaitSync(null)).toBe(0)
    })

    it('sums predicted consultation times', () => {
      const queue = [
        { status: 'waiting', predicted_consultation_time: 15 },
        { status: 'waiting', predicted_consultation_time: 20 },
      ]
      expect(calculateEstimatedWaitSync(queue)).toBe(35)
    })

    it('accounts for remaining time of in_consultation patient', () => {
      const calledAt = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago
      const queue = [
        { status: 'in_consultation', predicted_consultation_time: 15, called_at: calledAt },
      ]
      const wait = calculateEstimatedWaitSync(queue)
      expect(wait).toBeLessThan(15)
      expect(wait).toBeGreaterThanOrEqual(0)
    })
  })

  describe('formatWaitTime', () => {
    it('returns "Now" for 0 or negative', () => {
      expect(formatWaitTime(0)).toBe('Now')
      expect(formatWaitTime(-5)).toBe('Now')
    })

    it('formats minutes correctly', () => {
      expect(formatWaitTime(30)).toBe('30 min')
      expect(formatWaitTime(59)).toBe('59 min')
    })

    it('formats hours correctly', () => {
      expect(formatWaitTime(60)).toBe('1h')
      expect(formatWaitTime(90)).toBe('1h 30min')
      expect(formatWaitTime(120)).toBe('2h')
    })
  })

  describe('getExpectedConsultationTime', () => {
    it('returns correct future time', () => {
      const now = new Date('2024-01-01T10:00:00Z')
      const expected = getExpectedConsultationTime(now, 30)
      expect(expected.getTime()).toBe(new Date('2024-01-01T10:30:00Z').getTime())
    })

    it('accepts string dates', () => {
      const result = getExpectedConsultationTime('2024-01-01T10:00:00Z', 15)
      expect(result instanceof Date).toBe(true)
    })
  })
})
