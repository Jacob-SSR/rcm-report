'use client';

import LegacyCatalog from './legacy-catalog';
import ReportPeriodInput from './report-period-input';
import { initialPeriod, reportRange, reportToday, type ReportPeriod } from '../lib/report-period';
import ClaimFiles from './claim-files';
import ReportBreakdown from './report-breakdown';
import { useCallback, useEffect, useState } from 'react';
import { reports, fundNames, type GroupBy, type ReportData, type ReportId, type Row } from '../lib/reports';

const paths: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  chart: <><path d="M4 4v16h17M8 15l4-5 4 2 5-7"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8V5a2 2 0 0 1 2-2h12M16 11h5v5h-5a2.5 2.5 0 0 1 0-5"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  down: <path d="m7 10 5 5 5-5"/>,
  right: <path d="m9 5 7 7-7 7"/>,
  left: <path d="m15 5-7 7 7 7"/>,
  arrow: <path d="M7 17 17 7M7 7h10v10"/>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></>,
  print: <><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><path d="M16 11h1"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2"/></>,
  filter: <><path d="M4 7h16M7 12h10M10 17h4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  alert: <><path d="m12 3 10 18H2zM12 9v4M12 17h.01"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
  settings: <><path d="m9 3 1-1h4l1 3 3 1 3 1v4l-2 2v3l-2 3h-4l-2-2H8l-3-1v-4l1-2V7z"/><circle cx="12" cy="11" r="3"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3M12 17h.01"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6a8 8 0 0 1 13.3 2M4.6 16a8 8 0 0 0 13.3 2"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  heart: <><path d="M3 12h5l3-7 3 14 3-7h4"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/></>,
};
function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) { return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] || paths.file}</svg>; }
const money = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)} ล.` : n >= 1000 ? `${(n / 1000).toFixed(0)} พัน` : n.toFixed(0);
const thaiDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2.5 text-[12px] font-medium transition hover:bg-slate-50';
const colors = ['#22745d', '#82b4a3', '#bbcdb5', '#dfc993', '#c9d0d5'];
type View = 'overview' | 'claims' | 'outstanding' | 'reports' | 'files';

export default function Dashboard() {
  const [view, setView] = useState<View>('overview');
  const [report, setReport] = useState<ReportId>('repdata');
  const [pickedPeriod, setPickedPeriod] = useState<ReportPeriod | null>(null);
  const [fund, setFund] = useState(''), [service, setService] = useState(''), [status, setStatus] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy | ''>('');
  const [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [data, setData] = useState<ReportData | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [modal, setModal] = useState<'settings' | 'help' | null>(null), [selected, setSelected] = useState<Row | null>(null);
  const [mobile, setMobile] = useState(false), [chartMode, setChartMode] = useState<'claimed' | 'compensated'>('claimed');
  const [connection, setConnection] = useState<{demo: boolean; rcm: boolean; hosxp: boolean; user?: string} | null>(null);
  const demo = connection?.demo === true;
  const live = connection?.demo === false;
  const modeReady = demo || live;
  const current = reports.find(r => r.id === report)!;
  const baseline = initialPeriod(demo, reportToday());
  const period = pickedPeriod?.mode === 'sample' && !demo ? baseline : pickedPeriod ?? baseline;
  const range = reportRange(period);
  const activeStatus = view === 'outstanding' && !status ? 'pending' : status;
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!modeReady) return;
    setLoading(true); setError('');
    if (!range.start || !range.end || range.start > range.end) { setLoading(false);setError('กรุณาเลือกช่วงวันที่ให้ถูกต้อง');setData(null);return; }
    try {
      const p = new URLSearchParams({ report, start: range.start, end: range.end, fund, service, q: search, status: activeStatus, page: String(page) });
      if (groupBy) p.set('groupBy', groupBy);
      const response = await fetch('/api/reports?' + p, { signal, cache: 'no-store' });
      if (response.status === 401) { window.location.replace('/login/'); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'โหลดรายงานไม่สำเร็จ');
      if (result.mode !== (demo ? 'demo' : 'live')) throw new Error('โหมดข้อมูลเปลี่ยน กรุณาโหลดหน้าใหม่');
      setData(result);
    } catch (e) { if (signal?.aborted) return; setError(e instanceof Error ? e.message : 'ไม่สามารถโหลดรายงานได้'); setData(null); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [modeReady, demo, report, range.start, range.end, fund, service, search, activeStatus, page, groupBy]);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(controller.signal), 180);
    return () => { clearTimeout(t); controller.abort(); };
  }, [load]);
  const refreshConnection = useCallback(async () => {
    setConnectionError('');
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (response.status === 401) { window.location.replace('/login/'); return; }
      if (!response.ok) throw new Error('API status unavailable');
      const status = await response.json();
      if (typeof status.demo !== 'boolean') throw new Error('Invalid status');
      setConnection(status);
    } catch {
      setConnection(null);
      setData(null);
      setConnectionError('อ่านสถานะเซิร์ฟเวอร์ไม่ได้ ตรวจว่าเปิดด้วย npm run dev หรือ npm start จากโฟลเดอร์โครงการ');
    }
  }, []);
  useEffect(() => { void refreshConnection(); }, [refreshConnection]);
  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') { setModal(null); setSelected(null); setMobile(false); } }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); }, []);
  const navigate = (v: View) => { setView(v); setPage(1); setStatus(''); setSearch(''); setMobile(false); };
  const exportDates = new URLSearchParams({ start: range.start, end: range.end });
  const exportFilters = new URLSearchParams({ ...Object.fromEntries(exportDates), report, fund, service, q: search, status: activeStatus });
  const exportRoute = '/api/reports/export?';
  const exportReady = modeReady && !!range.start && !!range.end && range.start <= range.end;
  const [showBulk, setShowBulk] = useState(false);
  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Logout failed');
      window.location.replace('/login/');
    } catch { window.alert('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง'); }
  }
  const title = { overview: 'ภาพรวมรายได้', claims: 'ติดตามการชดเชย', outstanding: 'รายการรอชดเชย', reports: 'คลังรายงาน', files: 'ตรวจไฟล์และเทียบยอด' }[view];
  const summary = data?.summary;
  const rate = summary?.claimed ? (summary.compensated / summary.claimed * 100) : 0;

  return <div className="min-h-screen">
    {mobile && <button aria-label="ปิดเมนู" onClick={() => setMobile(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"/>}
    <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-[#152d32] text-white transition-transform lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[87px] items-center gap-3 px-6"><div className="flex size-9 items-center justify-center rounded-xl bg-[#def0e8] text-[#1d5b4b]"><Icon name="heart" size={25}/></div><div><div className="text-[25px] font-semibold leading-none tracking-[-1px]">rcm<span className="text-[#a3c5b7]">.</span></div><div className="mt-1.5 text-[9px] tracking-[2.4px] text-[#a2babd]">REPORT STUDIO</div></div></div>
      <div className="mx-4 mb-7 rounded-lg border border-white/10 bg-white/[.035] px-3 py-3"><div className="text-[10px] text-[#8ea9ac]">WORKSPACE</div><div className="mt-1.5 flex items-center justify-between text-xs"><span>ศูนย์รายงานการเงิน</span><span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-[#bdd1cd]">RCM</span></div></div>
      <div className="mb-2 px-6 text-[10px] tracking-[1.5px] text-[#7f9da0]">ภาพรวมการดำเนินงาน</div>
      <nav aria-label="เมนูหลัก" className="space-y-1 px-3">
        {([['overview','grid','ภาพรวมรายได้'],['claims','chart','ติดตามการชดเชย'],['outstanding','wallet','รายการรอชดเชย'],['reports','file','คลังรายงาน'],['files','check','ตรวจไฟล์และเทียบยอด']] as const).map(([key,icon,label]) => <button key={key} onClick={() => navigate(key)} aria-current={view === key ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[12px] transition ${view === key ? 'bg-[#dceee6] font-medium text-[#1b5142]' : 'text-[#b0c5c6] hover:bg-white/5 hover:text-white'}`}><Icon name={icon} size={17}/>{label}{view === key && <span className="ml-auto size-1.5 rounded-full bg-[#347b61]"/>}</button>)}
      </nav>
      <div className="mx-6 my-6 border-t border-white/10"/>
      <div className="mb-2 px-6 text-[10px] tracking-[1.5px] text-[#7f9da0]">การจัดการ</div>
      <div className="px-3"><button onClick={() => setModal('settings')} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-xs text-[#b0c5c6] hover:bg-white/5"><Icon name="database" size={17}/>การเชื่อมต่อข้อมูล</button><button onClick={() => setModal('help')} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-xs text-[#b0c5c6] hover:bg-white/5"><Icon name="help" size={17}/>คู่มือการใช้งาน</button></div>
      <div className="mx-4 mt-auto mb-5 rounded-xl border border-[#3c5b5c] bg-[#1c393c] p-3.5"><div className="flex items-center gap-2 text-[11px] text-[#d3e4dc]"><Icon name="shield" size={15}/>{live ? 'ข้อมูลจากฐานข้อมูล' : 'พื้นที่ทดลองรายงาน'}</div><p className="mt-2 text-[10px] leading-5 text-[#91adae]">{live ? 'อ่านข้อมูลเพื่อแสดงรายงานเท่านั้น' : 'สำรวจหน้ารายงานด้วยข้อมูลจำลอง ก่อนเชื่อมต่อระบบของคุณ'}</p><button onClick={() => setModal('settings')} className="mt-3 flex w-full items-center justify-between border-t border-white/10 pt-3 text-[11px] text-[#c4dfd2]">{live ? 'ดูสถานะการเชื่อมต่อ' : 'ตั้งค่าฐานข้อมูล'}<Icon name="arrow" size={14}/></button></div>
      <div className="flex items-center gap-2.5 border-t border-white/10 px-5 py-4"><div className="flex size-8 items-center justify-center rounded-full bg-[#d5e2d9] text-xs font-semibold text-[#315149]">RC</div><div className="text-[11px]">Report workspace<div className="mt-0.5 text-[9px] text-[#8eaaac]">RCM / HOSxP</div></div><span className="ml-auto text-[9px] text-[#7f9da0]">v1.0</span></div>
    </aside>

    <div className="lg:ml-[232px]">
      <header className="no-print flex h-[69px] items-center justify-between border-b border-line bg-white px-5 md:px-8 xl:px-10"><div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMobile(true)} aria-label="เปิดเมนู"><Icon name="menu"/></button><span className="hidden text-[11px] text-muted sm:inline">Report Studio</span><span className="hidden text-[#c2c9cc] sm:inline">/</span><span className="text-xs font-medium">{title}</span></div><div className="flex items-center gap-4"><span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f4f0e4] text-[#8a7342]'}`}><span className={`size-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-[#b39a5c]'}`}/>{live ? 'LIVE DATA' : demo ? 'DEMO WORKSPACE' : 'กำลังตรวจสถานะ'}</span><span className="hidden h-5 border-l border-line sm:block"/>{connection?.user && <><span className="hidden max-w-36 truncate text-xs text-muted sm:inline">{connection.user}</span><button onClick={logout} className="whitespace-nowrap text-xs text-brand hover:underline">ออกจากระบบ</button></>}<button aria-label="การตั้งค่า" onClick={() => setModal('settings')} className="text-muted hover:text-brand"><Icon name="settings"/></button></div></header>
      <main className="mx-auto max-w-[1600px] px-4 py-7 md:px-8 xl:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-medium tracking-[2px] text-brand"><span className="h-px w-5 bg-brand"/>REVENUE INTELLIGENCE</div><h1 className="text-[27px] font-semibold tracking-[-.7px] md:text-[30px]">{title}<span className="ml-1 text-brand">.</span></h1><p className="mt-2 text-[12px] text-muted">{view === 'reports' ? 'เปิดรายงานเว็บและค้นหาเมนูจาก RCM ต้นฉบับ' : view === 'files' ? 'ตรวจยอดเรียกเก็บกับไฟล์ตอบกลับก่อนนำไปใช้งาน' : 'มองเห็นรายได้ ติดตามยอดชดเชย และจัดการรายการที่ต้องดูแล'}</p></div><div className="no-print flex gap-2"><button className={button} onClick={() => window.print()}><Icon name="print" size={15}/><span className="hidden sm:inline">พิมพ์รายงาน</span></button>{view !== 'files' && <button className={button} disabled={!exportReady} onClick={() => setShowBulk(value => !value)}><Icon name="download" size={15}/>ส่งออกทุกชุด</button>}
        {data && exportReady && view !== 'reports' && view !== 'files' && <a className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-medium text-white" href={exportRoute + exportFilters} target="_blank" rel="noreferrer"><Icon name="download" size={15}/>ส่งออก CSV</a>}</div></div>
        {showBulk && exportReady && view !== 'files' && <section className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-xs">
          <div>
            <h2 className="font-semibold">ส่งออกทุกชุดที่เปิดใช้ในเว็บ</h2>
            <p className="mt-1 text-muted">{thaiDate(range.start)} ถึง {thaiDate(range.end)} · ไม่ใช้ตัวกรองสิทธิ สถานะ หรือคำค้น</p>
            <p className="mt-1 text-muted">รายงานอ้างอิง HOSxP ส่งออกทุกแถว · ดูผลแต่ละชุดใน export-status.csv</p>
          </div>
          <a className="rounded-lg bg-brand px-4 py-2.5 text-white" href={exportRoute + exportDates + '&all=1'} target="_blank" rel="noreferrer">ดาวน์โหลด ZIP</a>
        </section>}
        {connectionError && <div role="alert" className="no-print mb-5 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{connectionError}<button onClick={refreshConnection} className="ml-auto underline">ลองอีกครั้ง</button></div>}
        {demo && <div className="no-print mb-5 flex items-center gap-2.5 rounded-lg border border-[#e9e4d4] bg-[#fbf9f1] px-3.5 py-2.5 text-[11px] text-[#8a7955]"><Icon name="alert" size={15}/><span>ข้อมูลตัวอย่างสำหรับออกแบบหน้าจอ <span className="hidden md:inline">· ตัวเลขและ HN ทั้งหมดเป็นข้อมูลจำลอง</span></span><button className="ml-auto whitespace-nowrap font-medium underline underline-offset-4" onClick={() => setModal('settings')}>เชื่อมข้อมูลจริง</button></div>}

        {view === 'files' ? <ClaimFiles /> : view === 'reports' ? <LegacyCatalog period={period} demo={demo} onPeriodChange={setPickedPeriod} openReport={id => { setReport(id); setFund(''); setService(''); navigate('overview'); }} /> : <>
          <section aria-label="ตัวกรองรายงาน" className="no-print mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3.5"><div className="hidden items-center gap-2 border-r border-line pr-3 text-xs text-muted xl:flex"><Icon name="filter" size={16}/>ตัวกรอง</div><label className="flex min-w-44 flex-1 items-center gap-2 rounded-lg bg-[#f6f8f7] px-3 py-2 text-xs"><Icon name="file" size={15}/><select aria-label="ประเภทรายงาน" value={report} onChange={e => { setReport(e.target.value as ReportId); setFund(''); setService(''); setPage(1); }} className="w-full bg-transparent outline-none">{reports.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><ReportPeriodInput period={period} demo={demo} onChange={value => { setPickedPeriod(value); setPage(1); }}/><select aria-label="สิทธิการรักษา" value={fund} onChange={e => { setFund(e.target.value); setPage(1); }} className="rounded-lg border border-line bg-white px-3 py-2 text-xs"><option value="">ทุกสิทธิการรักษา</option>{Object.entries(fundNames).map(([k,v]) => <option value={k} key={k}>{v} ({k})</option>)}</select><select aria-label="ประเภทบริการ" value={service} disabled={report === 'ktb'} onChange={e => { setService(e.target.value); setPage(1); }} className="rounded-lg border border-line bg-white px-3 py-2 text-xs"><option value="">OPD + IPD</option><option>OPD</option><option>IPD</option></select><button onClick={() => load()} className="rounded-lg p-2 text-muted hover:bg-paper hover:text-brand" aria-label="รีเฟรชรายงาน"><Icon name="refresh" size={17} className={loading ? 'animate-spin' : ''}/></button></section>
          {error && <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700"><Icon name="alert"/>{error}<button onClick={() => load()} className="ml-auto underline">ลองอีกครั้ง</button></div>}
          <div className="print-grid mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
            { label: 'ยอดเรียกเก็บทั้งหมด', value: summary?.claimed, icon: 'wallet', foot: `${summary?.count.toLocaleString('th-TH') ?? '—'} รายการในช่วงเวลาที่เลือก`, tone: 'text-brand bg-[#edf5f1]' },
            { label: current.source === 'HOSxP' || report === 'ktb' ? 'ยอดชำระแล้ว' : 'ยอดชดเชยแล้ว', value: summary?.compensated, icon: 'check', foot: `${rate.toFixed(1)}% ของยอดเรียกเก็บ`, tone: 'text-brand bg-[#edf5f1]' },
            { label: 'ส่วนต่างรอชดเชย', value: summary?.outstanding, icon: 'clock', foot: 'เรียกเก็บ − ชดเชย (เฉพาะส่วนต่างบวก)', tone: 'text-[#a1844e] bg-[#faf5e9]' },
            { label: 'รายการติดข้อผิดพลาด', value: summary?.errors, icon: 'alert', foot: 'ตรวจสอบรหัสและแก้ไขก่อนส่งใหม่', tone: 'text-[#ba7866] bg-[#faf0ec]', count: true },
          ].map((k,i) => <article key={k.label} className={`relative overflow-hidden rounded-xl border bg-white p-5 ${i===0 ? 'border-[#bed4c9]' : 'border-line'}`}><div className="flex items-center justify-between"><span className="text-[11px] text-muted">{k.label}</span><span className={`flex size-8 items-center justify-center rounded-lg ${k.tone}`}><Icon name={k.icon} size={17}/></span></div><div className="mt-4 flex items-baseline gap-1.5"><span className="font-sans text-[27px] font-semibold tracking-[-1px] tabular-nums 2xl:text-[31px]">{loading && !data ? '—' : k.value === undefined ? '—' : k.count ? k.value.toLocaleString('th-TH') : money(k.value)}</span><span className="text-[10px] text-muted">{k.count ? 'รายการ' : 'บาท'}</span></div><div className="mt-3 text-[10px] text-muted">{k.foot}</div>{i===0 && <span className="absolute inset-x-5 bottom-0 h-0.5 bg-[#75a48c]"/>}</article>)}</div>
          <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]"><section className="min-w-0 rounded-xl border border-line bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[13px] font-semibold">จังหวะของรายได้</h2><p className="mt-1 text-[10px] text-muted">ยอดเรียกเก็บและยอดชดเชยตามเดือนบริการ</p></div><select aria-label="ยอดที่แสดงบนกราฟ" value={chartMode} onChange={e => setChartMode(e.target.value as 'claimed' | 'compensated')} className="no-print rounded-md border border-line bg-white px-2 py-1.5 text-[10px]"><option value="claimed">ยอดเรียกเก็บ</option><option value="compensated">ยอดชดเชย / ชำระ</option></select></div><RevenueChart data={data?.trend || []} mode={chartMode}/><div className="flex items-center justify-center gap-5 text-[10px] text-muted"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand"/>เรียกเก็บ</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[#b9cbbf]"/>ชดเชย / ชำระ</span></div></section>
          <section className="rounded-xl border border-line bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-[13px] font-semibold">สัดส่วนตามสิทธิการรักษา</h2><span className="text-[10px] text-muted">ยอดเรียกเก็บ</span></div><div className="my-5 flex items-center gap-5"><Donut funds={data?.funds || []} count={summary?.count || 0}/><div><p className="text-[10px] text-muted">สิทธิที่มียอดสูงสุด</p><div className="mt-1.5 text-lg font-semibold">{data?.funds[0]?.name || '—'}</div><p className="mt-1 text-[10px] text-muted">{data?.funds[0] ? fundNames[data.funds[0].name] || data.funds[0].name : 'ไม่มีข้อมูลในช่วงเวลานี้'}</p></div></div><div className="space-y-2.5">{(data?.funds || []).slice(0,5).map((f,i) => <button key={f.name} onClick={() => {setFund(fund === f.name ? '' : f.name);setPage(1);}} className="flex w-full items-center gap-2 text-left text-[10px] hover:text-brand"><span className="size-2 rounded-sm" style={{ background: colors[i%5] }}/><span className="flex-1 truncate">{fundNames[f.name] || f.name}</span><span className="font-medium tabular-nums">{compact(f.value)}</span><span className="w-10 text-right tabular-nums text-muted">{summary?.claimed ? (f.value/summary.claimed*100).toFixed(0) : 0}%</span></button>)}</div></section></div>
          <ReportBreakdown dimension={groupBy} onChange={value => { setGroupBy(value); setLoading(!!value); }} groups={loading ? [] : data?.breakdown ?? []} loading={loading} demo={demo}/>
          <section className="overflow-hidden rounded-xl border border-line bg-white"><div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5"><div className="flex items-center gap-2"><h2 className="text-[13px] font-semibold">{view === 'outstanding' ? 'รายการที่รอชดเชย' : 'รายละเอียดการเรียกเก็บ'}</h2><span className="rounded-md bg-[#f0f3f2] px-1.5 py-0.5 text-[10px] text-muted">{data?.total ?? 0}</span></div><label className="no-print flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-muted"><Icon name="search" size={14}/><input value={search} onChange={e => {setSearch(e.target.value);setPage(1);}} aria-label="ค้นหา HN หรือเลขที่รายการ" placeholder="ค้นหา HN, เลขที่, รหัสผิดพลาด" className="w-48 bg-transparent text-[10px] outline-none"/></label></div><div className="no-print mt-3 flex gap-5 overflow-x-auto border-b border-line px-5">{[['','ทั้งหมด'],['ชดเชยแล้ว','ชดเชยแล้ว'],['pending','รอชดเชย'],['error','ติดข้อผิดพลาด']].map(([s,label]) => <button key={s} onClick={() => {setStatus(s);setPage(1);}} className={`whitespace-nowrap border-b-2 py-3 text-[11px] ${activeStatus === s ? 'border-brand font-medium text-brand' : 'border-transparent text-muted hover:text-ink'}`}>{label}{s === 'error' && !!summary?.errors && <span className="ml-1.5 rounded bg-[#faefeb] px-1 text-[9px] text-[#bb7c68]">{summary.errors}</span>}</button>)}</div>
          <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-[11px]"><thead className="bg-[#f9faf9] text-[10px] font-normal text-muted"><tr>{['วันที่บริการ','HN / เลขที่รายการ','ประเภท','สิทธิการรักษา','เรียกเก็บ (บาท)','ชดเชย/ชำระ (บาท)','สถานะ',''].map((h,i) => <th key={i} className={`px-5 py-3 font-medium ${i===4||i===5?'text-right':''}`}>{h}</th>)}</tr></thead><tbody className="divide-y divide-[#f0f2f2]">{data?.rows.map(r => <tr key={r.id} className="group hover:bg-[#f6faf8]"><td className="px-5 py-3.5 text-[#55666c]">{thaiDate(r.date)}</td><td className="px-5 py-3"><div className="font-medium tabular-nums">{r.hn || '—'}</div><div className="mt-0.5 max-w-36 truncate text-[9px] text-muted">{r.id}</div></td><td className="px-5 py-3"><span className={`rounded px-1.5 py-0.5 text-[9px] ${r.service==='IPD'?'bg-[#eef0f7] text-[#6d7897]':'bg-[#f0f4f3] text-[#758980]'}`}>{r.service || '—'}</span></td><td className="px-5 py-3"><div className="font-medium">{r.fund || '—'}</div><div className="mt-0.5 text-[9px] text-muted">{fundNames[r.fund] || 'สิทธิจากฐานข้อมูล'}</div></td><td className="px-5 py-3 text-right font-medium tabular-nums">{money(r.claimed)}</td><td className="px-5 py-3 text-right tabular-nums text-[#65786d]">{money(r.compensated)}</td><td className="px-5 py-3"><Status row={r}/></td><td className="py-3 pr-4"><button onClick={() => setSelected(r)} aria-label={`ดูรายละเอียด ${r.id}`} className="rounded p-1 text-[#a0aca7] hover:bg-[#e5efe9] hover:text-brand"><Icon name="right" size={15}/></button></td></tr>)}</tbody></table>{(!data?.rows.length) && <div className="flex flex-col items-center gap-3 py-14 text-muted"><Icon name={loading?'refresh':'search'} size={28}/><p className="text-xs">{loading ? 'กำลังโหลดรายงาน...' : error ? 'ยังไม่สามารถแสดงข้อมูลได้' : 'ไม่พบรายการตามตัวกรองที่เลือก'}</p>{!loading && !error && <button onClick={() => {setFund('');setService('');setSearch('');setStatus('');setPage(1);}} className="text-xs text-brand underline">ล้างตัวกรอง</button>}</div>}</div>
          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-[10px] text-muted"><span>แสดง {data?.total ? (page-1)*10+1 : 0}–{Math.min(page*10,data?.total||0)} จาก {(data?.total||0).toLocaleString('th-TH')} รายการ</span><div className="flex items-center gap-1"><button aria-label="หน้าก่อนหน้า" disabled={page===1} onClick={() => setPage(page-1)} className="rounded border border-line p-1.5"><Icon name="left" size={14}/></button><span className="min-w-8 px-2 text-center font-medium text-brand">{page}</span><span className="px-1">/ {Math.max(1,Math.ceil((data?.total||0)/10))}</span><button aria-label="หน้าถัดไป" disabled={page>=Math.ceil((data?.total||0)/10)} onClick={() => setPage(page+1)} className="rounded border border-line p-1.5"><Icon name="right" size={14}/></button></div></div></section>
          <p className="mt-3 text-[10px] leading-5 text-muted">{report === 'ktb' ? 'รายงาน KTB ใช้วันที่รับชำระ และแสดงส่วนต่างระหว่าง Income กับ Amount' : 'ส่วนต่างรอชดเชยใช้เพื่อการติดตาม ยังไม่ใช่ยอดลูกหนี้ตามบัญชี · วันที่อ้างอิงวันรับบริการ (HOSxP IPD ใช้วันจำหน่าย)'}</p>
        </>}
        <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[9px] text-[#9aa4a9]"><span>RCM REPORT STUDIO <span className="mx-2">/</span> ออกแบบมาเพื่อเห็นภาพรวมที่ชัดกว่า</span><span>{live ? 'LIVE · อ่านข้อมูลจากฐานข้อมูล' : demo ? 'DEMO · ข้อมูลจำลอง' : 'กำลังตรวจสถานะเซิร์ฟเวอร์'} <span className="mx-2">·</span> RCM161169</span></footer>
      </main>
    </div>
    {(modal || selected) && <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[#102a2c]/40 p-4 backdrop-blur-[3px]" onClick={() => {setModal(null);setSelected(null);}}><div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-brand"><Icon name={selected?'file':modal==='help'?'help':'database'} size={21}/><h2 id="dialog-title" className="text-lg font-semibold">{selected ? 'รายละเอียดรายการ' : modal==='help' ? 'เริ่มต้นใช้งาน' : 'การเชื่อมต่อข้อมูล'}</h2></div><button autoFocus onClick={() => {setModal(null);setSelected(null);}} aria-label="ปิดหน้าต่าง" className="rounded-lg p-2 text-muted hover:bg-paper"><Icon name="close"/></button></div>
      {selected ? <><p className="mt-2 text-xs text-muted">{current.name} {demo?'· ข้อมูลจำลอง':''}</p><div className="mt-6 space-y-3">{[['เลขที่รายการ',selected.id],['วันที่บริการ',thaiDate(selected.date)],['HN',selected.hn],['บริการ / สิทธิ',`${selected.service} / ${selected.fund}`],['ยอดเรียกเก็บ',money(selected.claimed)+' บาท'],['ยอดชดเชย / ชำระ',money(selected.compensated)+' บาท'],['ส่วนต่างคงเหลือ',money(Math.max(0,selected.claimed-selected.compensated))+' บาท'],['สถานะ',selected.status],['รหัสข้อผิดพลาด',selected.error||'—']].map(([k,v]) => <div className="flex justify-between gap-4 border-b border-line py-2 text-xs" key={k}><span className="text-muted">{k}</span><span className="break-all text-right font-medium">{v}</span></div>)}</div></> : modal === 'settings' ? <><p className="mt-3 text-xs leading-6 text-muted">ตั้งค่าฐานข้อมูลในไฟล์ <code className="rounded bg-paper px-1.5 py-1 text-ink">.env</code> บนเครื่องที่รันเว็บเซิร์ฟเวอร์ รหัสผ่านจะอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น</p><div className="mt-5 space-y-3">{[['RCM','RCM_DB_*',connection?.rcm],['HOSxP','HOSXP_DB_*',connection?.hosxp]].map(([label,env,ready]) => <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-line p-4"><div className="rounded-lg bg-paper p-2.5 text-brand"><Icon name="database"/></div><div><div className="text-sm font-medium">{label}</div><div className="mt-1 text-[10px] text-muted">{env}</div></div><span className={`ml-auto text-[10px] ${ready?'text-brand':'text-muted'}`}>{ready?'ตั้งค่าแล้ว':'ยังไม่ตั้งค่า'}</span></div>)}</div><ol className="mt-5 list-inside list-decimal space-y-2 text-xs leading-6 text-muted"><li>คัดลอก <code>.env.example</code> เป็น <code>.env</code></li><li>กรอก Host, Port, Database, User และ Password</li><li>ใช้บัญชีฐานข้อมูลที่มีสิทธิ SELECT เท่านั้น</li><li>เปลี่ยน <code>DEMO_MODE=false</code> แล้วหยุดและรัน <code>npm run dev</code> ใหม่ หรือสร้าง container ใหม่หากใช้ Docker</li></ol><div className="mt-5 rounded-lg bg-[#f2f6f3] p-3 text-[11px] leading-6 text-[#597667]">สถานะนี้แสดงว่าเซิร์ฟเวอร์ได้รับค่าจาก .env หรือยัง การเข้าสู่ระบบและเปิดรายงานจะตรวจการเชื่อมต่อฐานข้อมูลจริง</div><button className={button+' mt-5 w-full'} onClick={refreshConnection}><Icon name="refresh" size={15}/>ตรวจสอบการตั้งค่าอีกครั้ง</button></> : <div className="mt-6 space-y-5 text-xs leading-6">{[['01','เลือกข้อมูลที่ต้องการดู','ใช้ตัวกรองเลือกรายงาน ช่วงเวลา สิทธิ และประเภทผู้ป่วย'],['02','ตามรายการให้ถึงรายละเอียด','ค้นหาด้วย HN หรือเลขที่รายการ กดลูกศรท้ายแถวเพื่อดูรายละเอียด'],['03','นำรายงานไปทำงานต่อ','ส่งออก CSV ตามตัวกรองที่เลือก หรือสั่งพิมพ์เป็น PDF ผ่านเบราว์เซอร์']].map(([n,t,d]) => <div key={n} className="flex gap-4"><span className="font-mono text-lg text-[#a7bdae]">{n}</span><div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-muted">{d}</p></div></div>)}<div className="rounded-lg bg-paper p-4 text-muted">ข้อมูลจาก ZIP ใช้เพื่ออ้างอิงหมวดรายงานและโครงสร้างเท่านั้น หน้าจอนี้ไม่รันคำสั่ง SQL หรือโปรแกรมจากไฟล์ต้นฉบับ</div></div>}
    </div></div>}
  </div>;
}

function Status({row}: {row: Row}) { const color = row.error ? 'bg-[#fbefeb] text-[#b66f58]' : !row.compensated ? 'bg-[#f8f3e7] text-[#a08750]' : row.compensated<row.claimed ? 'bg-[#edf2f7] text-[#68829b]' : 'bg-[#edf6f0] text-[#4b8564]'; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] ${color}`}><span className="size-1 rounded-full bg-current"/>{row.status}{row.error && <span className="opacity-70">· {row.error}</span>}</span>; }
function RevenueChart({data,mode}: {data: ReportData['trend'];mode: 'claimed' | 'compensated'}) {
  const max = Math.max(...data.map(r => Math.max(r.claimed,r.compensated)),1)*1.18;
  const x = (i:number) => data.length===1 ? 320 : 60+i*540/Math.max(1,data.length-1);
  const y = (n:number) => 174-n/max*145;
  const points = (key:'claimed'|'compensated') => data.map((d,i)=>`${x(i)},${y(d[key])}`).join(' ');
  return <div className="my-3"><svg role="img" aria-label="กราฟยอดเรียกเก็บและยอดชดเชยรายเดือน" viewBox="0 0 640 215" className="h-[195px] w-full"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#438e71" stopOpacity=".13"/><stop offset="100%" stopColor="#438e71" stopOpacity="0"/></linearGradient></defs>{[0,1,2,3].map(i=><g key={i}><line x1="55" x2="610" y1={30+i*48} y2={30+i*48} stroke="#edf0ed" strokeDasharray="3 4"/><text x="44" y={33+i*48} textAnchor="end" fill="#9aa6a1" fontSize="9">{compact(max*(1-i/3))}</text></g>)}{data.length>1 && <polygon points={`${x(0)},174 ${points(mode)} ${x(data.length-1)},174`} fill="url(#area)"/>}{(['compensated','claimed'] as const).map(key=><g key={key}><polyline points={points(key)} fill="none" stroke={key==='claimed'?'#22745d':'#b9cbbf'} strokeWidth={key===mode?2.5:1.5} strokeDasharray={key==='compensated'?'5 4':undefined} strokeLinejoin="round"/>{data.map((d,i)=><circle key={i} cx={x(i)} cy={y(d[key])} r={key===mode?4:2.5} fill="white" stroke={key==='claimed'?'#22745d':'#b9cbbf'} strokeWidth="2"><title>{d.month} · {key==='claimed'?'เรียกเก็บ':'ชดเชย'} {money(d[key])} บาท</title></circle>)}</g>)}{data.map((d,i)=><text key={d.month} x={x(i)} y="201" textAnchor="middle" fill="#889790" fontSize="10">{new Date(d.month+'-01').toLocaleDateString('th-TH',{month:'short'})}</text>)}{!data.length && <text x="330" y="106" textAnchor="middle" fill="#889790" fontSize="12">ไม่มีข้อมูลในช่วงเวลานี้</text>}</svg></div>;
}
function Donut({funds,count}: {funds: ReportData['funds'];count:number}) { const total=funds.reduce((s,f)=>s+f.value,0);let acc=0;return <svg role="img" aria-label="สัดส่วนยอดเรียกเก็บแยกตามสิทธิ" viewBox="0 0 128 128" className="size-[118px] shrink-0"><circle cx="64" cy="64" r="48" fill="none" stroke="#eff3ef" strokeWidth="13"/>{funds.map((f,i)=>{const pct=total?f.value/total:0;const offset=acc;acc+=pct;return <circle key={f.name} cx="64" cy="64" r="48" fill="none" stroke={colors[i%5]} strokeWidth="13" strokeDasharray={`${Math.max(0,pct*301.59-3)} 301.59`} strokeDashoffset={-offset*301.59} transform="rotate(-90 64 64)"><title>{f.name} {money(f.value)} บาท</title></circle>;})}<text x="64" y="64" textAnchor="middle" fill="#243a30" fontSize="23" fontWeight="600">{count.toLocaleString('th-TH')}</text><text x="64" y="82" textAnchor="middle" fill="#8e9b93" fontSize="9">รายการ</text></svg>; }
