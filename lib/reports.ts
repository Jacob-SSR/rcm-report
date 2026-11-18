export type Row = { id: string; date: string; hn: string; service: string; fund: string; claimed: number; compensated: number; error: string; status: string };
export type Summary = { count: number; claimed: number; compensated: number; outstanding: number; errors: number };
export const groupLabels = {
  fund: 'สิทธิการรักษา',
  service: 'ประเภทบริการ OPD / IPD',
  month: 'เดือนบริการ',
  error: 'รหัสข้อผิดพลาด',
} as const;
export type GroupBy = keyof typeof groupLabels;
export type ReportGroup = Summary & { key: string };
export type ReportData = { rows: Row[]; total: number; summary: Summary; funds: { name: string; value: number; count: number }[]; trend: { month: string; claimed: number; compensated: number }[]; mode: 'demo' | 'live'; updatedAt: string; breakdown?: ReportGroup[] };

export function groupRows(rows: Row[], dimension: GroupBy): ReportGroup[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = dimension === 'month' ? row.date.slice(0, 7) : row[dimension];
    if (dimension === 'error' && !key.trim()) continue;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups, ([key, records]) => ({ key, ...summarize(records) }))
    .sort((a, b) => dimension === 'month' ? a.key.localeCompare(b.key)
      : b.claimed - a.claimed || a.key.localeCompare(b.key));
}
export const reports = [
  { id: 'repdata', name: 'รายงานตอบกลับ REP', short: 'REP', description: 'ยอดเรียกเก็บและยอดชดเชยจากไฟล์ตอบกลับ', table: 'repdata', source: 'RCM', category: 'การชดเชย' },
  { id: 'repeclaim', name: 'รายงานตอบกลับ e-Claim', short: 'e-Claim', description: 'ยอดเรียกเก็บและยอดชดเชยจากตาราง repeclaim', table: 'repeclaim', source: 'RCM', category: 'การชดเชย' },
  { id: 'repfdh', name: 'รายงานตอบกลับ FDH', short: 'FDH', description: 'ติดตามผลการเบิกจ่ายผ่าน Financial Data Hub', table: 'repfdh', source: 'RCM', category: 'การชดเชย' },
  { id: 'repstatus', name: 'สถานะการส่งเบิก', short: 'CLAIM', description: 'ผลการส่งเบิกและรายการที่มีรหัสข้อผิดพลาด', table: 'repstatus', source: 'RCM', category: 'ติดตามรายการ' },
  { id: 'seamless', name: 'รายงาน Seamless', short: 'STM', description: 'ยอดชดเชยและรอบการจ่ายเงินของกองทุน', table: 'seamless', source: 'RCM', category: 'การชดเชย' },
  { id: 'ktb', name: 'รายงานรับชำระ KTB', short: 'KTB', description: 'เทียบยอด Income และ Amount ตามวันที่รับชำระ KTB', table: 'ktb', source: 'RCM', category: 'รับชำระ' },
  { id: 'hosxp_opd', name: 'รายได้ผู้ป่วยนอก HOSxP', short: 'OPD', description: 'ค่ารักษาและยอดชำระจาก vn_stat', table: 'vn_stat', source: 'HOSxP', category: 'รายได้บริการ' },
  { id: 'hosxp_ipd', name: 'รายได้ผู้ป่วยใน HOSxP', short: 'IPD', description: 'ค่ารักษาและยอดชำระจาก an_stat', table: 'an_stat', source: 'HOSxP', category: 'รายได้บริการ' },
] as const;
export type ReportId = typeof reports[number]['id'];
export function summarize(rows: Row[]): Summary {
  const claimed = rows.reduce((s, r) => s + r.claimed, 0), compensated = rows.reduce((s, r) => s + r.compensated, 0);
  return { count: rows.length, claimed, compensated, outstanding: rows.reduce((s, r) => s + Math.max(0, r.claimed - r.compensated), 0), errors: rows.filter(r => !!r.error).length };
}
export function demoRows(report: string): Row[] {
  const funds = ['UC', 'CSMBS', 'SSS', 'LGO', 'OTHER'];
  return Array.from({ length: 432 }, (_, i) => {
    const month = 6 + Math.floor(i / 72), day = 1 + i % (month === 11 ? 18 : 28);
    const claimed = Math.round((1850 + (i * 7319 % 158000)) * (report === 'repfdh' ? .72 : report.includes('opd') ? .16 : 1));
    const state = i % 11; const error = state === 3 ? 'C019' : state === 8 ? 'C305' : '';
    const compensated = error || state === 5 ? 0 : state === 7 ? Math.round(claimed * .74) : claimed;
    return { id: `DEMO-${i + 1}`, date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, hn: `D${String(100000 + i)}`, service: i % 4 ? 'OPD' : 'IPD', fund: funds[i % 10 < 5 ? 0 : i % 10 < 7 ? 1 : i % 10 - 5], claimed, compensated, error, status: error ? 'ติดข้อผิดพลาด' : !compensated ? 'รอชดเชย' : compensated < claimed ? 'ชดเชยบางส่วน' : 'ชดเชยแล้ว' };
  });
}
export const fundNames: Record<string, string> = { UC: 'หลักประกันสุขภาพ', CSMBS: 'ข้าราชการ', SSS: 'ประกันสังคม', LGO: 'องค์กรปกครองส่วนท้องถิ่น', OTHER: 'สิทธิอื่น ๆ' };
export function getDemo(report: string, start: string, end: string, fund: string, service: string, q: string, status: string, page: number, groupBy?: GroupBy, exportAll = false): ReportData {
  const all = demoRows(report).filter(r => r.date >= start && r.date <= end && (!fund || r.fund === fund) && (!service || r.service === service) && (!status || (status === 'error' ? !!r.error : status === 'pending' ? !r.compensated && !r.error : r.status === status)) && (!q || `${r.hn} ${r.id} ${r.error}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const groups = new Map<string, { name: string; value: number; count: number }>();
  for (const r of all) { const v = groups.get(r.fund) || { name: r.fund, value: 0, count: 0 }; v.value += r.claimed; v.count++; groups.set(r.fund, v); }
  const trend: ReportData['trend'] = [];
  for (const r of all) { const month = r.date.slice(0, 7); let t = trend.find(x => x.month === month); if (!t) { t = { month, claimed: 0, compensated: 0 }; trend.push(t); } t.claimed += r.claimed; t.compensated += r.compensated; }
  return { rows: exportAll ? all : all.slice((page - 1) * 10, page * 10), total: all.length, summary: summarize(all), funds: [...groups.values()].sort((a, b) => b.value - a.value), trend: trend.sort((a, b) => a.month.localeCompare(b.month)), mode: 'demo', updatedAt: 'ข้อมูลจำลองสำหรับออกแบบหน้าจอ', ...(groupBy && { breakdown: groupRows(all, groupBy) }) };
}
