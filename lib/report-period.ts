export type ReportPeriod = {
  mode: 'range' | 'month' | 'year' | 'sample';
  from: string;
  to: string;
  month: string;
  buddhistYear: string;
};

export function reportToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function initialPeriod(demo: boolean, today: string): ReportPeriod {
  return {
    mode: demo ? 'sample' : 'range',
    from: today,
    to: today,
    month: today.slice(0, 7),
    buddhistYear: String(Number(today.slice(0, 4)) + 543),
  };
}

export function reportRange(period: ReportPeriod): { start: string; end: string } {
  if (period.mode === 'sample') return { start: '2026-06-01', end: '2026-11-30' };
  if (period.mode === 'month') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.month)) return { start: '', end: '' };
    const [year, month] = period.month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: period.month + '-01', end: period.month + '-' + String(lastDay).padStart(2, '0') };
  }
  if (period.mode === 'year') {
    const year = Number(period.buddhistYear) - 543;
    if (!Number.isInteger(year) || year < 1900 || year > 9999) return { start: '', end: '' };
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  return { start: period.from, end: period.to };
}
