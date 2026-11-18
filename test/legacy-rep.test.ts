import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyReports } from '../lib/legacy-reports';
import { legacyQuery } from '../lib/legacy-sql';
import catalog from '../lib/legacy-catalog.json';

const parent = 'MENU05D01D01D03';
const days = { start: '2026-11-01', end: '2026-11-30' };
function query(suffix: string) {
  const report = legacyReports.find(item => item.id === parent + suffix);
  assert.ok(report);
  return legacyQuery(report, days);
}

test('all original REP fund menu IDs have an implementation', () => {
  const original = catalog[0].rows.filter(row => row.id.startsWith(parent)).map(row => row.id).sort();
  assert.equal(original.length, 18);
  assert.deepEqual(legacyReports.filter(row => row.rep).map(row => row.id).sort(), original);
});

test('preserves the per-menu REP conditions from the original SQL', () => {
  assert.match(query('D01').sql, /r.SendDate >= \?.*r.ErrorCode IS NULL.*GROUP BY r.SubFund/s);
  assert.match(query('D02D01').sql, /r.ErrorCode IS NULL.*r.AN IS NULL/s);
  assert.doesNotMatch(query('D03D01').sql, /ErrorCode/);
  assert.deepEqual(query('D02').args.slice(2), ['UCS']);
  assert.deepEqual(query('D02D02').args.slice(2), ['UCS', 'WEL']);
  assert.deepEqual(query('D03D05').args.slice(2), ['SSS', 'SSI']);
  assert.ok(query('D02D07').args.includes('STP'));
  assert.ok(!query('D03D07').args.includes('STP'));
});
