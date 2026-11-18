import { fundNames, groupLabels, type GroupBy, type ReportGroup } from '../lib/reports';

const amount = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function groupName(dimension: GroupBy, key: string) {
  if (dimension === 'fund') return fundNames[key] ? `${fundNames[key]} (${key})` : key || 'ไม่ระบุสิทธิ';
  if (dimension === 'month') return new Date(key + '-01T12:00:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  return key || 'ไม่ระบุ';
}

function exportGroups(dimension: GroupBy, groups: ReportGroup[], demo: boolean) {
  const escape = (value: string | number) => {
    const text = String(value);
    return '"' + (typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
  };
  const rows = [
    [groupLabels[dimension], 'จำนวนรายการ', 'ยอดเรียกเก็บ', 'ยอดชดเชย / ชำระ', 'ส่วนต่างคงเหลือ', 'รายการติดข้อผิดพลาด'],
    ...groups.map(group => [groupName(dimension, group.key), group.count, group.claimed, group.compensated, group.outstanding, group.errors]),
  ];
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `RCM-summary-${dimension}${demo ? '-DEMO' : ''}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportBreakdown({ dimension, onChange, groups, loading, demo }: {
  dimension: GroupBy | '';
  onChange: (value: GroupBy | '') => void;
  groups: ReportGroup[];
  loading: boolean;
  demo: boolean;
}) {
  return <section className="mb-5 overflow-hidden rounded-xl border border-line bg-white" aria-label="สรุปรายงาน">
    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
      <h2 className="text-[13px] font-semibold">สรุปรายงานตามกลุ่ม</h2>
      <div className="no-print flex flex-wrap gap-2">
        <select aria-label="จัดกลุ่มรายงานตาม" className="rounded-lg border border-line px-3 py-2 text-xs" value={dimension}
          onChange={event => onChange(event.target.value as GroupBy | '')}>
          <option value="">เลือกกลุ่มที่ต้องการดู</option>
          {Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button className="rounded-lg border border-line px-3 py-2 text-xs text-brand" disabled={!dimension || loading || !groups.length}
          onClick={() => { if (dimension) exportGroups(dimension, groups, demo); }}>ส่งออกสรุป CSV</button>
      </div>
    </div>
    {dimension && <div className="overflow-x-auto border-t border-line" aria-busy={loading}>
      {!groups.length ? <p className="p-5 text-xs text-muted">{loading ? 'กำลังโหลดสรุป...' : 'ไม่พบข้อมูลตามตัวกรอง'}</p> :
        <table className="w-full min-w-[600px] text-xs">
          <thead className="bg-paper"><tr>
            {[groupLabels[dimension], 'จำนวนรายการ', 'เรียกเก็บ (บาท)', 'ชดเชย / ชำระ (บาท)', 'ส่วนต่าง (บาท)', 'ติดข้อผิดพลาด'].map((label, index) =>
              <th key={label} scope="col" className={`px-4 py-3 font-medium text-muted ${index ? 'text-right' : 'text-left'}`}>{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-line">{groups.map(group => <tr key={group.key}>
            <th scope="row" className="px-4 py-3 text-left font-medium">{groupName(dimension, group.key)}</th>
            <td className="px-4 py-3 text-right tabular-nums">{group.count.toLocaleString('th-TH')}</td>
            {[group.claimed, group.compensated, group.outstanding].map((value, index) =>
              <td key={index} className="px-4 py-3 text-right tabular-nums">{amount.format(value)}</td>)}
            <td className="px-4 py-3 text-right tabular-nums">{group.errors.toLocaleString('th-TH')}</td>
          </tr>)}</tbody>
        </table>}
    </div>}
  </section>;
}
