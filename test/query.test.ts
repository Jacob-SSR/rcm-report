import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFilters,escapeLike} from '../lib/query';
import {getDemo,summarize} from '../lib/reports';
test('rejects arbitrary tables, invalid pages, and invalid dates',()=>{
  for(const query of ['report=rcmuser','report=repdata;DROP TABLE patient','page=-1','page=2.2','start=2026-11-31','start=2026-12-01&end=2026-01-01']) assert.throws(()=>parseFilters(new URLSearchParams(query)));
});
test('search wildcard characters are literal',()=>assert.equal(escapeLike('HN%_!'), 'HN!%!_!!'));
test('demo totals match all paginated rows and scope',()=>{
  const first=getDemo('repdata','2026-11-01','2026-11-30','','','','',1);const all=[];
  for(let p=1;p<=Math.ceil(first.total/10);p++)all.push(...getDemo('repdata','2026-11-01','2026-11-30','','','','',p).rows);
  assert.deepEqual(summarize(all),first.summary);assert.equal(first.total,all.length);assert.ok(all.every(r=>r.date.startsWith('2026-11')));
  const errors=getDemo('repdata','2026-11-01','2026-11-30','','','','error',1);assert.ok(errors.rows.every(r=>r.error));
});
