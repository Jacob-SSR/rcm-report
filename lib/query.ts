import { reports, groupLabels, type GroupBy, type ReportId } from './reports';
export function parseFilters(params: URLSearchParams) {
  const report = params.get('report') || 'repdata';
  if (!reports.some(r => r.id === report)) throw new Error('ไม่รู้จักรายงานที่เลือก');
  const start = params.get('start') || '2026-01-01', end = params.get('end') || '2026-12-31';
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('ช่วงวันที่ไม่ถูกต้อง');
  const page = Number(params.get('page') || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error('เลขหน้าไม่ถูกต้อง');
  const service = params.get('service') || '';
  if (service && !['OPD','IPD'].includes(service)) throw new Error('ประเภทบริการไม่ถูกต้อง');
  const status = params.get('status') || '';
  if (!['','error','pending','ชดเชยแล้ว','ชดเชยบางส่วน'].includes(status)) throw new Error('สถานะไม่ถูกต้อง');
  const q = (params.get('q') || '').trim().slice(0,100), fund = (params.get('fund') || '').slice(0,40);
  const groupBy = params.get('groupBy');
  if (groupBy !== null && !Object.hasOwn(groupLabels, groupBy)) throw new Error('ประเภทสรุปไม่ถูกต้อง');
  return { report: report as ReportId, start, end, page, q, fund, service, status, groupBy: groupBy as GroupBy | null, exportAll: params.get('export') === '1' };
}
export function escapeLike(s: string) { return s.replace(/[!%_]/g, c => '!' + c); }
