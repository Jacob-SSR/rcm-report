'use client';

import { useEffect, useState } from 'react';
import type { LegacyReport } from '../lib/legacy-reports';
import { reportRange, type ReportPeriod } from '../lib/report-period';
import ReportPeriodInput from './report-period-input';

type Page = { columns: string[]; rows: (string | number | null)[][]; hasNext: boolean };

export default function LegacyReportView({ report, close, period, demo, onPeriodChange }: {
  report: LegacyReport;
  close: () => void;
  period: ReportPeriod;
  demo: boolean;
  onPeriodChange: (value: ReportPeriod) => void;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page>();
  const [error, setError] = useState('');
  const { start, end } = reportRange(period);
  const from = report.rep ? start : '';
  const to = report.rep ? end : '';
  const valid = !report.rep || (!!from && !!to && from <= to);
  const params = new URLSearchParams({ legacy: report.id, ...(report.rep && { start: from, end: to }) });
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError('');
    if (!valid) { setError('กรุณาเลือกช่วงวันที่ให้ถูกต้อง'); return; }
    async function load() {
      try {
        const query = new URLSearchParams({ legacy: report.id, page: String(page), ...(from && { start: from, end: to }) });
        const response = await fetch('/api/reports/legacy?' + query, { signal: controller.signal });
        if (response.status === 401) { window.location.replace('/login/'); return; }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'อ่านรายงานไม่สำเร็จ');
        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'อ่านรายงานไม่สำเร็จ');
      }
    }
    void load();
    return () => controller.abort();
  }, [report.id, page, from, to, valid]);

  return <section className="space-y-4 rounded-xl border border-line bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <button onClick={close} className="text-xs text-brand underline">กลับคลังรายงาน</button>
        <h2 className="mt-2 font-semibold">{report.title}</h2>
        <p className="mt-1 text-xs text-muted">{report.rep ? 'RCM REP · ใช้วันที่ส่งเบิก' : 'HOSxP · ข้อมูลอ้างอิงทุกแถว'}</p>
      </div>
      {valid && data && <a href={'/api/reports/export?' + params} target="_blank" rel="noreferrer"
        className="rounded-lg bg-brand px-4 py-2.5 text-xs text-white">ส่งออก CSV</a>}
    </div>
    {report.rep && <ReportPeriodInput period={period} demo={demo} onChange={value => { setPage(1); onPeriodChange(value); }}/>}
    {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>
      : !data ? <p className="text-xs text-muted">กำลังโหลดรายงาน…</p> : <>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead className="bg-paper text-muted"><tr>{data.columns.map(column => <th scope="col" key={column} className="px-3 py-3">{column}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{data.rows.map((row, index) => <tr key={index}>
              {row.map((cell, cellIndex) => <td className="px-3 py-2" key={cellIndex}>{cell ?? '—'}</td>)}
            </tr>)}</tbody>
          </table>
          {!data.rows.length && <p className="p-4 text-xs text-muted">ไม่มีข้อมูล</p>}
        </div>
        <div className="flex items-center justify-end gap-3 text-xs">
          <button className="rounded border border-line px-3 py-2" disabled={page === 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span>หน้า {page}</span>
          <button className="rounded border border-line px-3 py-2" disabled={!data.hasNext} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </div>
      </>}
  </section>;
}
