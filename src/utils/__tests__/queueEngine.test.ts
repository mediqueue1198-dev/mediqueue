import { describe, it, expect } from 'vitest';
import { calculatePriorityScore, sortQueue } from '../queueEngine';
import { QueueEntry } from '../../types/queue';

describe('Queue Engine', () => {
  describe('calculatePriorityScore', () => {
    it('should give higher priority to emergencies', () => {
      const entry: Partial<QueueEntry> = { queue_type: 'emergency', created_at: new Date().toISOString() };
      const score = calculatePriorityScore(entry);
      expect(score).toBeGreaterThanOrEqual(500);
    });

    it('should give higher priority to appointments over walk-ins', () => {
      const appt: Partial<QueueEntry> = { queue_type: 'appointment', created_at: new Date().toISOString() };
      const walkin: Partial<QueueEntry> = { queue_type: 'walk_in', created_at: new Date().toISOString() };
      
      expect(calculatePriorityScore(appt)).toBeGreaterThan(calculatePriorityScore(walkin));
    });

    it('should increase score over time (waiting bonus)', () => {
      const now = new Date();
      const tenMinsAgo = new Date(now.getTime() - 10 * 60000).toISOString();
      
      const entryNew: Partial<QueueEntry> = { queue_type: 'walk_in', created_at: now.toISOString() };
      const entryOld: Partial<QueueEntry> = { queue_type: 'walk_in', created_at: tenMinsAgo };
      
      expect(calculatePriorityScore(entryOld)).toBeGreaterThan(calculatePriorityScore(entryNew));
    });
  });

  describe('sortQueue', () => {
    it('should keep "in_consultation" at the very top', () => {
      const entries: any[] = [
        { id: '1', status: 'waiting', priority_score: 1000 },
        { id: '2', status: 'in_consultation', priority_score: 10 },
        { id: '3', status: 'waiting', priority_score: 500 },
      ];
      
      const sorted = sortQueue(entries);
      expect(sorted[0].id).toBe('2');
    });

    it('should sort waiting patients by priority score', () => {
      const entries: any[] = [
        { id: '1', status: 'waiting', priority_score: 100 },
        { id: '2', status: 'waiting', priority_score: 500 },
        { id: '3', status: 'waiting', priority_score: 300 },
      ];
      
      const sorted = sortQueue(entries);
      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });
  });
});
