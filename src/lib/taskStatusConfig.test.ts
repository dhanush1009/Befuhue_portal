import { describe, it, expect } from 'vitest';
import { isValidTransition, PIPELINE_COLUMNS, getDefaultStatus, getDoneStatus } from './taskStatusConfig';

describe('isValidTransition', () => {
  it('allows moving one step forward through the pipeline', () => {
    expect(isValidTransition('TO_DO', 'IN_PROGRESS', 'TASK', false).valid).toBe(true);
    expect(isValidTransition('IN_PROGRESS', 'INTERNAL_REVIEW', 'TASK', false).valid).toBe(true);
    expect(isValidTransition('INTERNAL_REVIEW', 'CLIENT_REVIEW', 'TASK', false).valid).toBe(true);
    expect(isValidTransition('CLIENT_REVIEW', 'DONE', 'TASK', false).valid).toBe(true);
    expect(isValidTransition('DONE', 'CLOSED', 'TASK', false).valid).toBe(true);
  });

  it('rejects skipping stages for non-admins', () => {
    const result = isValidTransition('TO_DO', 'CLIENT_REVIEW', 'TASK', false);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/workflow order/i);
  });

  it('rejects skipping stages for bugs the same way as tasks (unified pipeline)', () => {
    expect(isValidTransition('TO_DO', 'DONE', 'BUG', false).valid).toBe(false);
  });

  it('allows moving backwards any number of stages', () => {
    expect(isValidTransition('CLOSED', 'TO_DO', 'TASK', false).valid).toBe(true);
    expect(isValidTransition('DONE', 'IN_PROGRESS', 'TASK', false).valid).toBe(true);
  });

  it('allows a same-status no-op move', () => {
    expect(isValidTransition('IN_PROGRESS', 'IN_PROGRESS', 'TASK', false).valid).toBe(true);
  });

  it('lets admins skip stages freely', () => {
    expect(isValidTransition('TO_DO', 'CLOSED', 'TASK', true).valid).toBe(true);
    expect(isValidTransition('TO_DO', 'DONE', 'BUG', true).valid).toBe(true);
  });
});

describe('pipeline shape', () => {
  it('has exactly the 6 unified agency stages, in order', () => {
    expect(PIPELINE_COLUMNS).toEqual([
      'TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED',
    ]);
  });

  it('starts every item type at TO_DO', () => {
    expect(getDefaultStatus('TASK')).toBe('TO_DO');
    expect(getDefaultStatus('BUG')).toBe('TO_DO');
  });

  it('uses DONE as the completion status for every item type', () => {
    expect(getDoneStatus('TASK')).toBe('DONE');
    expect(getDoneStatus('BUG')).toBe('DONE');
  });
});
