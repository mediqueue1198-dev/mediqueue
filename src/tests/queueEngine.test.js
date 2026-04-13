import { describe, it, expect } from 'vitest'
import {
  calculatePriorityScore,
  sortQueue,
  getCurrentPatient,
  getNextPatients,
  getPatientPosition,
  generateToken,
  balanceDoctorLoad,
  recalculateQueue,
} from '../utils/queueEngine'

const makeEntry = (overrides = {}) => ({
  id: `entry-${Math.random()}`,
  doctor_id: 'doc-1',
  patient_id: `patient-${Math.random()}`,
  queue_type: 'walk_in',
  status: 'waiting',
  check_in_status: true,
  check_in_time: new Date().toISOString(),
  scheduled_time: null,
  priority_score: 100,
  predicted_consultation_time: 15,
  created_at: new Date().toISOString(),
  ...overrides,
})

describe('Queue Engine', () => {
  describe('calculatePriorityScore', () => {
    it('gives emergency highest priority', () => {
      const emergency = makeEntry({ queue_type: 'emergency' })
      const appointment = makeEntry({ queue_type: 'appointment' })
      const walkin = makeEntry({ queue_type: 'walk_in' })
      expect(calculatePriorityScore(emergency)).toBeGreaterThan(calculatePriorityScore(appointment))
      expect(calculatePriorityScore(appointment)).toBeGreaterThan(calculatePriorityScore(walkin))
    })

    it('adds check-in bonus', () => {
      const checkedIn = makeEntry({ check_in_status: true })
      const notCheckedIn = makeEntry({ check_in_status: false })
      expect(calculatePriorityScore(checkedIn)).toBeGreaterThan(calculatePriorityScore(notCheckedIn))
    })

    it('penalizes late appointment patients', () => {
      const onTime = makeEntry({
        queue_type: 'appointment',
        scheduled_time: new Date(Date.now() + 30 * 60000).toISOString(),
      })
      const late = makeEntry({
        queue_type: 'appointment',
        scheduled_time: new Date(Date.now() - 30 * 60000).toISOString(),
      })
      expect(calculatePriorityScore(onTime)).toBeGreaterThan(calculatePriorityScore(late))
    })

    it('returns a positive number', () => {
      expect(calculatePriorityScore(makeEntry())).toBeGreaterThan(0)
    })
  })

  describe('sortQueue', () => {
    it('puts in_consultation first', () => {
      const entries = [
        makeEntry({ status: 'waiting', priority_score: 300 }),
        makeEntry({ status: 'in_consultation', priority_score: 50 }),
        makeEntry({ status: 'waiting', priority_score: 100 }),
      ]
      const sorted = sortQueue(entries)
      expect(sorted[0].status).toBe('in_consultation')
    })

    it('sorts waiting by priority_score descending', () => {
      const entries = [
        makeEntry({ status: 'waiting', priority_score: 100 }),
        makeEntry({ status: 'waiting', priority_score: 300 }),
        makeEntry({ status: 'waiting', priority_score: 200 }),
      ]
      const sorted = sortQueue(entries)
      const waiting = sorted.filter(e => e.status === 'waiting')
      expect(waiting[0].priority_score).toBeGreaterThan(waiting[1].priority_score)
      expect(waiting[1].priority_score).toBeGreaterThan(waiting[2].priority_score)
    })

    it('does not mutate original array', () => {
      const entries = [makeEntry(), makeEntry()]
      const original = [...entries]
      sortQueue(entries)
      expect(entries).toEqual(original)
    })
  })

  describe('getCurrentPatient', () => {
    it('returns the in_consultation entry', () => {
      const entries = [
        makeEntry({ status: 'waiting' }),
        makeEntry({ status: 'in_consultation', patient_id: 'current' }),
      ]
      const current = getCurrentPatient(entries)
      expect(current?.patient_id).toBe('current')
    })

    it('returns null if no one in consultation', () => {
      const entries = [makeEntry({ status: 'waiting' })]
      expect(getCurrentPatient(entries)).toBeNull()
    })
  })

  describe('getNextPatients', () => {
    it('returns waiting patients sorted by priority', () => {
      const entries = [
        makeEntry({ status: 'waiting', priority_score: 200, check_in_status: true }),
        makeEntry({ status: 'waiting', priority_score: 100, check_in_status: true }),
        makeEntry({ status: 'in_consultation' }),
      ]
      const next = getNextPatients(entries, 2)
      expect(next).toHaveLength(2)
      expect(next[0].priority_score).toBeGreaterThan(next[1].priority_score)
    })

    it('only includes checked-in patients', () => {
      const entries = [
        makeEntry({ status: 'waiting', check_in_status: false, priority_score: 500 }),
        makeEntry({ status: 'waiting', check_in_status: true, priority_score: 100 }),
      ]
      const next = getNextPatients(entries, 3)
      expect(next.every(e => e.check_in_status)).toBe(true)
    })
  })

  describe('getPatientPosition', () => {
    it('returns correct 1-indexed position', () => {
      const entries = [
        makeEntry({ status: 'waiting', priority_score: 300, patient_id: 'a' }),
        makeEntry({ status: 'waiting', priority_score: 200, patient_id: 'b' }),
        makeEntry({ status: 'waiting', priority_score: 100, patient_id: 'c' }),
      ]
      expect(getPatientPosition(entries, 'a')).toBe(1)
      expect(getPatientPosition(entries, 'b')).toBe(2)
      expect(getPatientPosition(entries, 'c')).toBe(3)
    })

    it('returns 0 for patient not in queue', () => {
      expect(getPatientPosition([], 'unknown')).toBe(0)
    })
  })

  describe('generateToken', () => {
    it('generates correct prefixes', () => {
      expect(generateToken('emergency', [])).toMatch(/^E-/)
      expect(generateToken('walk_in', [])).toMatch(/^W-/)
      expect(generateToken('appointment', [])).toMatch(/^T-/)
    })

    it('increments based on existing entries', () => {
      const existing = [{ token_number: 'W-001' }, { token_number: 'W-002' }]
      expect(generateToken('walk_in', existing)).toBe('W-003')
    })
  })

  describe('balanceDoctorLoad', () => {
    it('sorts doctors by estimated wait (lowest first)', () => {
      const doctors = [
        { id: 'd1', consultation_avg_time: 15 },
        { id: 'd2', consultation_avg_time: 15 },
      ]
      const queuesByDoctor = {
        d1: [
          makeEntry({ status: 'waiting', predicted_consultation_time: 30 }),
          makeEntry({ status: 'waiting', predicted_consultation_time: 30 }),
        ],
        d2: [makeEntry({ status: 'waiting', predicted_consultation_time: 10 })],
      }
      const balanced = balanceDoctorLoad(doctors, queuesByDoctor)
      expect(balanced[0].id).toBe('d2') // lower wait
    })
  })

  describe('recalculateQueue', () => {
    it('returns sorted entries with recalculated scores', () => {
      const entries = [
        makeEntry({ status: 'waiting', priority_score: 1 }),
        makeEntry({ status: 'waiting', priority_score: 999 }),
      ]
      const result = recalculateQueue(entries)
      expect(result).toHaveLength(2)
      expect(result[0].priority_score).toBeGreaterThanOrEqual(result[1].priority_score)
    })
  })
})
