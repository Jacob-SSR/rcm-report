'use client';

import { useRef, useState } from 'react';
import { parseClaimFile, reconcileClaims, reconcileCsv, type ClaimFile } from '../lib/claim-files';

type Side = 'claimed' | 'paid';
type Selection = { name: string; data?: ClaimFile; error?: string };
const labels = { claimed: 'ไฟล์ยอดเรียกเก็บ', paid: 'ไฟล์ยอดตอบกลับ' };
const initial: Record<Side, Selection | null> = { claimed: null, paid: null };
const currency = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = (cents?: number) => cents === undefined ? '—' : currency.format(cents / 100);

export default function ClaimFiles() {
  const [files, setFiles] = useState(initial);
  const request = useRef({ claimed: 0, paid: 0 });
  const [onlyDifferences, setOnlyDifferences] = useState(true);
  const [page, setPage] = useState(1);
  const left = files.claimed?.data;
  const right = files.paid?.data;
  const ready = !!left && !!right && !left.issues.length && !right.issues.length;
  const rows = ready ? reconcileClaims(left.rows, right.rows) : [];
  const differences = rows.filter(row => row.status !== 'ยอดตรงกัน');
  const filtered = onlyDifferences ? differences : rows;

  async function selectFile(side: Side, file?: File) {
    const call = ++request.current[side];
    setPage(1);
    setFiles(current => ({ ...current, [side]: file ? { name: file.name } : null }));
    if (!file) return;
    let result: Selection;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');
      const data = parseClaimFile(await file.text(), side);
      result = { name: file.name, data };
    } catch (error) {
      result = { name: file.name, error: error instanceof Error ? error.message : 'อ่านไฟล์ไม่สำเร็จ' };
    }
    if (request.current[side] === call) setFiles(current => ({ ...current, [side]: result }));
  }

  function download(content: string, name: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="space-y-4">
    <p className="rounded-lg border border-line bg-white p-4 text-xs leading-6 text-muted">
      เลือกไฟล์ CSV แบบ UTF-8 สองไฟล์เพื่อจับคู่ตามเลขที่รายการ ตรวจรายการซ้ำ และหาส่วนต่าง ไฟล์จะถูกอ่านในเบราว์เซอร์ของเครื่องนี้
    </p>
    <div className="grid gap-4 md:grid-cols-2">
      {(['claimed', 'paid'] as const).map(side => {
        const file = files[side];
        return <section key={side} className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-semibold">{labels[side]}</h2>
          <p className="my-2 text-xs text-muted">คอลัมน์หลัก <code>claim_id,{side}</code></p>
          <input type="file" accept=".csv,text/csv" aria-label={labels[side]} onChange={event => selectFile(side, event.target.files?.[0])}
            className="block w-full rounded-lg border border-line p-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-paper file:px-2 file:py-1" />
          <button onClick={() => download(`claim_id,${side}\r\nDEMO-001,1500.00\r\nDEMO-002,250.00\r\n`, `rcm-${side}-template.csv`)}
            className="mt-3 text-xs text-brand underline underline-offset-4">ดาวน์โหลดแม่แบบ</button>
          {file?.error && <p role="alert" className="mt-3 text-xs text-red-700">{file.error}</p>}
          {file?.data && <p className="mt-3 text-xs text-muted">{file.data.rows.length.toLocaleString()} รายการผ่านการตรวจ · {file.data.issues.length.toLocaleString()} จุดที่ต้องแก้</p>}
          {!!file?.data?.issues.length && <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-red-700">
            {file.data.issues.map((issue, index) => <li key={index}>{issue}</li>)}
          </ul>}
        </section>;
      })}
    </div>
    {ready && <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div><h2 className="font-semibold">ผลเทียบยอด</h2><p className="mt-1 text-xs text-muted">{rows.length.toLocaleString()} รายการ · ต้องตรวจ {differences.length.toLocaleString()} รายการ</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyDifferences}
            onChange={event => { setOnlyDifferences(event.target.checked); setPage(1); }} />แสดงเฉพาะรายการที่ต้องตรวจ</label>
          <button className="rounded-lg bg-brand px-3 py-2 text-xs text-white" disabled={!filtered.length}
            onClick={() => download(reconcileCsv(filtered), 'rcm-claim-reconciliation.csv')}>ส่งออก CSV</button>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead className="bg-paper text-muted"><tr>{['เลขที่รายการ','เรียกเก็บ','รับชำระ','ส่วนต่าง','ผลตรวจ'].map(label => <th scope="col" className="px-4 py-3" key={label}>{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{filtered.slice((page-1)*20, page*20).map(row => <tr key={row.id}>
            <th scope="row" className="px-4 py-3 font-medium">{row.id}</th>
            <td className="px-4 py-3 tabular-nums">{format(row.requested)}</td>
            <td className="px-4 py-3 tabular-nums">{format(row.received)}</td>
            <td className="px-4 py-3 tabular-nums">{format(row.difference)}</td>
            <td className="px-4 py-3">{row.status}</td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <p className="p-5 text-xs text-muted">ยอดตรงกันทุกรายการ</p>}
      </div>
      {filtered.length > 20 && <div className="flex items-center justify-end gap-3 border-t border-line p-3 text-xs">
        <button disabled={page===1} className="rounded border border-line px-2 py-1" onClick={() => setPage(page-1)}>ก่อนหน้า</button>
        <span>{page} / {Math.ceil(filtered.length/20)}</span>
        <button disabled={page*20>=filtered.length} className="rounded border border-line px-2 py-1" onClick={() => setPage(page+1)}>ถัดไป</button>
      </div>}
    </section>}
  </div>;
}
