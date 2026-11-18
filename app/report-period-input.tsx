import type { ReportPeriod } from '../lib/report-period';

const input = 'rounded-lg border border-line bg-white px-2.5 py-2 text-xs';

export default function ReportPeriodInput({ period, demo, onChange }: {
  period: ReportPeriod;
  demo: boolean;
  onChange: (period: ReportPeriod) => void;
}) {
  return <div className="flex flex-wrap items-center gap-2">
    <select className={input} aria-label="ช่วงเวลา" value={period.mode}
      onChange={event => onChange({ ...period, mode: event.target.value as ReportPeriod['mode'] })}>
      <option value="range">จากวันที่ถึงวันที่</option>
      <option value="month">รายเดือน</option>
      <option value="year">รายปี</option>
      {demo && <option value="sample">ช่วงข้อมูลตัวอย่าง</option>}
    </select>
    {period.mode === 'range' && <>
      <input className={input} aria-label="จากวันที่" type="date" value={period.from}
        onChange={event => onChange({ ...period, from: event.target.value })} />
      <span className="text-xs text-muted">ถึง</span>
      <input className={input} aria-label="ถึงวันที่" type="date" value={period.to}
        onChange={event => onChange({ ...period, to: event.target.value })} />
    </>}
    {period.mode === 'month' && <input className={input} aria-label="เดือนและปีบริการ" type="month" value={period.month}
      onChange={event => onChange({ ...period, month: event.target.value })} />}
    {period.mode === 'year' && <label className="flex items-center gap-2 text-xs text-muted">ปี พ.ศ.
      <input className={input + ' w-24'} type="number" min={2443} max={10542} step={1} value={period.buddhistYear}
        onChange={event => onChange({ ...period, buddhistYear: event.target.value })} />
    </label>}
  </div>;
}
