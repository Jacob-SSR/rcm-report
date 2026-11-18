import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClaimFile, reconcileClaims, reconcileCsv } from '../lib/claim-files';

test('reconciles valid CSV in integer satang and keeps unmatched records', () => {
  const claims = parseClaimFile('\uFEFFclaim_id,claimed\r\n"001","1,000.10"\r\n002,0.30\r\n', 'claimed');
  const replies = parseClaimFile('claim_id,paid\n002,0.10\n=FORMULA,5.00\n', 'paid');
  assert.deepEqual(claims.issues, []);
  assert.deepEqual(replies.issues, []);
  const result = reconcileClaims(claims.rows, replies.rows);
  assert.deepEqual(result.map(row => [row.id, row.difference]), [['001',100010], ['002',20], ['=FORMULA',-500]]);
  assert.match(reconcileCsv(result), /"'=FORMULA"/);
});
test('reports duplicate or bad data and rejects malformed quoting', () => {
  const result = parseClaimFile('id,claimed\n001,5\n001,8\n002,"12,34"\n003,2.222', 'claimed');
  assert.equal(result.rows.length, 1);
  assert.equal(result.issues.length, 3);
  assert.throws(() => parseClaimFile('id,claimed\n001,"2', 'claimed'));
});
