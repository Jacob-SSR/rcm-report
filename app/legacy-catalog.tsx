'use client';

import { useMemo, useState } from 'react';
import catalog from '../lib/legacy-catalog.json';
import { reports, type ReportId } from '../lib/reports';
import { legacyReports, type LegacyReport } from '../lib/legacy-reports';
import LegacyReportView from './legacy-report-view';
import type { ReportPeriod } from '../lib/report-period';

const mainSource = catalog[0].id;
const pageSize = 20;
const kindLabel: Record<string, string> = {
  menu: 'หมวดเมนู',
  task: 'รายงาน / คำสั่งงาน',
  audit: 'ตรวจสอบข้อมูล',
  template: 'แม่แบบ',
};
const control = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-xs';
const sourceLabel: Record<string,string> = {
  'SQL4RCM.SQL': 'เมนูหลัก RCM',
  'SQL4RCM_New.SQL': 'เมนู RCM ชุด New',
  'SQL4RCM_AUDIT.SQL': 'RCM Audit',
  'SQL4RCM_CustomSearch.SQL': 'ค้นหาแบบกำหนดเอง',
  'SQL4RCM_TEST.SQL': 'เมนูทดสอบ',
  'SQL4DataAudit_RCM.SQL': 'Data Audit RCM',
  'SQL4DataAudit_RCM_SO.SQL': 'Data Audit RCM SO',
  'SQL4DataAudit_jRCM.SQL': 'Data Audit jRCM',
};

export default function LegacyCatalog({ openReport, period, demo, onPeriodChange }: {
  openReport: (id: ReportId) => void;
  period: ReportPeriod;
  demo: boolean;
  onPeriodChange: (value: ReportPeriod) => void;
}) {
  const [source, setSource] = useState(mainSource);
  const [group, setGroup] = useState('');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeReport, setActiveReport] = useState<LegacyReport>();
  const rows = useMemo(() => catalog
    .filter(item => !source || item.id === source)
    .flatMap(item => item.rows.map(row => ({ ...row, source: item.id }))), [source]);
  const groups = useMemo(() => [...new Set(rows.map(row => row.group))], [rows]);
  const query = search.trim().toLocaleLowerCase('th-TH');
  const filtered = rows.filter(row => (!group || row.group === group)
    && (!kind || row.kind === kind)
    && (!query || [row.name, row.id, row.group, row.path].join(' ').toLocaleLowerCase('th-TH').includes(query)));
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const first = (page - 1) * pageSize;

  if (activeReport) return <LegacyReportView key={activeReport.id} report={activeReport} close={() => setActiveReport(undefined)}
    period={period} demo={demo} onPeriodChange={onPeriodChange} />;
  return <div className="space-y-5">
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="font-semibold">เปิดดูได้ในเว็บ</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map(report => <button key={report.id} onClick={() => openReport(report.id)}
          className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-xs hover:border-brand hover:text-brand">
          <span>{report.name}</span><span aria-hidden="true">↗</span>
        </button>)}
        {legacyReports.map(report => <button key={report.id} onClick={() => setActiveReport(report)}
          className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-left text-xs hover:border-brand hover:text-brand">
          <span>{report.title}</span><span aria-hidden="true">↗</span>
        </button>)}
      </div>
    </section>
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="p-5">
        <h2 className="font-semibold">รายการจาก RCM161169</h2>
        <p className="mt-1 text-xs leading-6 text-muted">รวมเมนู รายงาน คำสั่งงาน และแม่แบบที่พบในไฟล์ต้นฉบับ รายการที่ยังไม่ได้ย้ายเข้าเว็บมีสถานะกำกับ</p>
        <div className="no-print mt-4 grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <input aria-label="ค้นหาเมนูต้นฉบับ" placeholder="ค้นหาชื่อหรือรหัสเมนู" value={search} className={control}
            onChange={event => { setSearch(event.target.value); setPage(1); }} />
          <select aria-label="ชุดเมนู" value={source} className={control}
            onChange={event => { setSource(event.target.value); setGroup(''); setPage(1); }}>
            <option value="">ทุกชุดเมนู</option>
            {catalog.map(item => <option value={item.id} key={item.id}>{sourceLabel[item.id] ?? item.id}</option>)}
          </select>
          <select aria-label="หมวดเมนู" value={group} className={control}
            onChange={event => { setGroup(event.target.value); setPage(1); }}>
            <option value="">ทุกหมวด</option>
            {groups.map(name => <option value={name} key={name}>{name}</option>)}
          </select>
          <select aria-label="ประเภทรายการ" value={kind} className={control}
            onChange={event => { setKind(event.target.value); setPage(1); }}>
            <option value="">ทุกประเภท</option>
            {Object.entries(kindLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead className="border-y border-line bg-paper text-muted"><tr>
            <th scope="col" className="px-5 py-3 font-medium">ชื่อและตำแหน่งในเมนูเดิม</th>
            <th scope="col" className="px-4 py-3 font-medium">ประเภท</th>
            <th scope="col" className="px-4 py-3 font-medium">สถานะบนเว็บ</th>
          </tr></thead>
          <tbody className="divide-y divide-line">
            {filtered.slice(first, first + pageSize).map((row, index) => <tr key={row.source + row.id + first + index}>
              <td className="px-5 py-3">
                <div className="font-medium">{row.name}</div>
                <div className="mt-1 leading-relaxed text-muted">{row.path || row.group}</div>
                <div className="mt-1 text-[10px] text-muted">{row.source} · {row.id}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{kindLabel[row.kind]}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {row.source === mainSource && legacyReports.some(report => report.id === row.id)
                  ? <button className="text-brand underline" onClick={() => setActiveReport(legacyReports.find(report => report.id === row.id))}>เปิดรายงาน</button>
                  : row.disabled ? 'ปิดไว้ในต้นฉบับ' : row.kind === 'menu' ? 'หมวดอ้างอิง' : 'ยังไม่ได้ย้าย'}
              </td>
            </tr>)}
          </tbody>
        </table>
        {!filtered.length && <p className="px-5 py-12 text-center text-xs text-muted">ไม่พบรายการตามตัวกรอง</p>}
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-muted">
        <span>แสดง {filtered.length ? first + 1 : 0}–{Math.min(first + pageSize, filtered.length)} จาก {filtered.length.toLocaleString('th-TH')} รายการ</span>
        <div className="flex items-center gap-2">
          <button className="rounded border border-line px-3 py-1.5" onClick={() => setPage(page - 1)} disabled={page === 1}>ก่อนหน้า</button>
          <span>{page} / {lastPage}</span>
          <button className="rounded border border-line px-3 py-1.5" onClick={() => setPage(page + 1)} disabled={page >= lastPage}>ถัดไป</button>
        </div>
      </div>
    </section>
  </div>;
}
