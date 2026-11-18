import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialPeriod, reportRange, reportToday } from '../lib/report-period';

test('live report defaults to the service date in Thailand', () => {
  const today = reportToday(new Date('2026-11-17T17:01:00Z'));
  assert.deepEqual(reportRange(initialPeriod(false, today)), { start: '2026-11-18', end: '2026-11-18' });
});

test('month and Buddhist-year selection cover the complete calendar period', () => {
  const baseline = initialPeriod(false, '2026-11-18');
  assert.deepEqual(reportRange({ ...baseline, mode: 'month', month: '2024-02' }), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(reportRange({ ...baseline, mode: 'year', buddhistYear: '2569' }), { start: '2026-01-01', end: '2026-12-31' });
  assert.deepEqual(reportRange({ ...baseline, mode: 'year', buddhistYear: '' }), { start: '', end: '' });
});
