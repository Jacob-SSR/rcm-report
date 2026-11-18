import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { parseEnv } from 'node:util';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import next from 'next';
import { reports, getDemo, type Row, type ReportData, type ReportGroup } from './lib/reports';
import { parseFilters, escapeLike } from './lib/query';
import { ExportBusy, reportCells, reportColumns, sendReports, type ExportJob } from './lib/report-export';
import { legacyReports, type LegacyReport } from './lib/legacy-reports';
import { legacyQuery } from './lib/legacy-sql';
import { authenticateHosxp, currentUser, limitLogin, readLogin, signIn, signOut } from './lib/auth';

const development = process.argv.includes('--dev');
const envPath = resolve('.env');
const fileSettings = readDevSettings();
function readDevSettings() {
  if (!development) return {};
  try { return parseEnv(readFileSync(envPath, 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}
function setting(key: string) {
  return Object.hasOwn(fileSettings, key) ? fileSettings[key] : process.env[key];
}
const host = development ? '127.0.0.1' : process.env.HOST || '127.0.0.1';
const port = development ? Number(process.env.DEV_PORT || 3000) : Number(process.env.PORT || 9000);
const nextApp = development ? next({ dev: true, hostname: host, port, webpack: true }) : undefined;
const nextHandler = nextApp?.getRequestHandler();
const modeSetting = setting('DEMO_MODE')?.trim().toLowerCase();
if (modeSetting && modeSetting !== 'true' && modeSetting !== 'false') {
  throw new Error('DEMO_MODE ต้องเป็น true หรือ false');
}
const demo = modeSetting !== 'false';
const secureCookie = process.env.APP_COOKIE_SECURE === undefined ? !demo && !development : process.env.APP_COOKIE_SECURE === 'true';
const root = resolve('out');
const pools = new Map<string, Pool>();
const prefixes = ['RCM', 'HOSXP'] as const;
function configured(prefix: string) { return ['HOST','NAME','USER'].every(k => !!setting(`${prefix}_DB_${k}`)); }
function poolFor(prefix: string) {
  if (!configured(prefix)) throw new Error(`กรุณาตั้งค่า ${prefix}_DB_HOST, ${prefix}_DB_NAME และ ${prefix}_DB_USER ใน .env`);
  let pool = pools.get(prefix);
  if (!pool) { pool = mysql.createPool({ host: setting(`${prefix}_DB_HOST`), port: Number(setting(`${prefix}_DB_PORT`) || 3306), database: setting(`${prefix}_DB_NAME`), user: setting(`${prefix}_DB_USER`), password: setting(`${prefix}_DB_PASSWORD`) || '', charset: setting(`${prefix}_DB_CHARSET`) || 'TIS620_THAI_CI', connectTimeout: 7000, connectionLimit: 4, waitForConnections: true, queueLimit: 12, multipleStatements: false, dateStrings: true, decimalNumbers: true }); pools.set(prefix,pool); }
  return pool;
}
const safeIdent = (s: string) => '`' + s.replaceAll('`','``') + '`';
type Filters = ReturnType<typeof parseFilters>;
type Query = (sql: string, values?: (string | number)[]) => Promise<RowDataPacket[]>;
async function withReportScope<T>(f: Filters, run: (scope: { query: Query; filtered: string; args: (string | number)[]; hasFilters: boolean }) => Promise<T>): Promise<T> {
  const def = reports.find(r => r.id === f.report)!;
  const prefix = def.source === 'HOSxP' ? 'HOSXP' : 'RCM';
  const conn = await poolFor(prefix).getConnection();
  try {
    const [fields] = await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${safeIdent(def.table)}`);
    const columns = new Map(fields.map(c => [String(c.Field).toLowerCase(),String(c.Field)]));
    const col = (...names: string[]) => { const c = names.find(n => columns.has(n.toLowerCase())); return c ? safeIdent(columns.get(c.toLowerCase())!) : null; };
    const isHis = prefix === 'HOSXP';
    const isKtb = f.report === 'ktb';
    const dt = isHis ? (f.report === 'hosxp_ipd' ? col('dchdate') : col('vstdate')) : isKtb ? col('KTBDate') : col('AdmDate','Date','DchDate');
    const claimed = isHis || isKtb ? col('Income') : col('Collected','Income');
    const paid = isHis ? col('paid_money') : isKtb ? col('Amount') : col('Compensated');
    if (!dt || !claimed || !paid) throw new Error(`โครงสร้าง ${def.table} ต่างจากต้นแบบ: ต้องมีคอลัมน์วันที่ ยอดเรียกเก็บ และยอดชดเชย/ชำระ`);
    const id = col('ID','Seq','ApprovalCode','VN','AN') || "''", hn = col('HN') || "''";
    const fund = col('MainInscl','Inscl','Fund','pttype') || "''";
    const error = col('ErrorCode') || "''";
    const an = col('AN');
    // AN presence is more reliable than version-specific Department codes.
    const service = isHis ? `'${f.report === 'hosxp_ipd' ? 'IPD' : 'OPD'}'` : an ? `CASE WHEN COALESCE(${an},'') <> '' THEN 'IPD' ELSE 'OPD' END` : isKtb ? "''" : "'OPD'";
    const base = `SELECT CAST(${id} AS CHAR) id, DATE(${dt}) date, ${hn} hn, ${service} service, COALESCE(${fund},'OTHER') fund, COALESCE(${claimed},0) claimed, COALESCE(${paid},0) compensated, COALESCE(${error},'') error FROM ${safeIdent(def.table)} WHERE ${dt} >= ? AND ${dt} < DATE_ADD(?, INTERVAL 1 DAY)`;
    const clauses: string[] = [], args: (string|number)[] = [f.start,f.end];
    if (f.fund) { clauses.push('fund = ?');args.push(f.fund); }
    if (f.service) { clauses.push('service = ?');args.push(f.service); }
    if (f.q) { clauses.push("(hn LIKE ? ESCAPE '!' OR id LIKE ? ESCAPE '!' OR error LIKE ? ESCAPE '!')");const v = '%' + escapeLike(f.q) + '%';args.push(v,v,v); }
    if (f.status === 'error') clauses.push("error <> ''");
    if (f.status === 'pending') clauses.push("compensated = 0 AND error = ''");
    if (f.status === 'ชดเชยแล้ว') clauses.push("compensated >= claimed AND compensated > 0 AND error = ''");
    if (f.status === 'ชดเชยบางส่วน') clauses.push("compensated > 0 AND compensated < claimed AND error = ''");
    const filtered = `FROM (${base}) r ${clauses.length ? 'WHERE '+clauses.join(' AND ') : ''}`;
    await conn.query('SET SESSION max_statement_time = 20').catch(() => {}); // MariaDB; query timeout also applies below.
    await conn.query('START TRANSACTION READ ONLY');
    const query = async (sql: string, values: (string|number)[] = args) => (await conn.execute<RowDataPacket[]>({sql,timeout:25000},values))[0];
    return await run({ query, filtered, args, hasFilters: clauses.length > 0 });
  } finally { await conn.rollback().catch(() => {}); conn.release(); }
}
function normalizeReportRow(row: RowDataPacket): Row {
  const claimed = Number(row.claimed);
  const compensated = Number(row.compensated);
  return {
    id: String(row.id ?? ''), date: String(row.date).slice(0, 10), hn: String(row.hn ?? ''),
    service: String(row.service), fund: String(row.fund), claimed, compensated, error: String(row.error),
    status: row.error ? 'ติดข้อผิดพลาด' : !compensated ? 'รอชดเชย' : compensated < claimed ? 'ชดเชยบางส่วน' : 'ชดเชยแล้ว',
  };
}
async function liveReport(f: Filters): Promise<ReportData> {
  return withReportScope(f, async ({ query, filtered, args, hasFilters }) => {
    const sums = (await query(`SELECT COUNT(*) count, COALESCE(SUM(claimed),0) claimed, COALESCE(SUM(compensated),0) compensated, COALESCE(SUM(GREATEST(0,claimed-compensated)),0) outstanding, COALESCE(SUM(error <> ''),0) errors ${filtered}`))[0];
    if (f.exportAll && Number(sums.count)>10000) throw new Error('ส่งออกได้สูงสุด 10,000 รายการ กรุณาลดช่วงเวลาหรือเพิ่มตัวกรอง');
    const funds = await query(`SELECT fund name, SUM(claimed) value, COUNT(*) count ${filtered} GROUP BY fund ORDER BY value DESC`);
    const trend = await query(`SELECT DATE_FORMAT(date,'%Y-%m') month, SUM(claimed) claimed, SUM(compensated) compensated ${filtered} GROUP BY month ORDER BY month`);
    let breakdown: ReportGroup[] | undefined;
    if (f.groupBy) {
      const dimensions = { fund: 'fund', service: 'service', month: "DATE_FORMAT(date,'%Y-%m')", error: 'error' } as const;
      const expression = dimensions[f.groupBy];
      const scope = f.groupBy === 'error'
        ? `${filtered} ${hasFilters ? 'AND' : 'WHERE'} TRIM(error) <> ''`
        : filtered;
      const order = f.groupBy === 'month' ? 'group_key' : 'claimed DESC, group_key';
      const groups = await query(`
        SELECT ${expression} AS group_key, COUNT(*) AS count,
          SUM(claimed) AS claimed, SUM(compensated) AS compensated,
          SUM(GREATEST(0, claimed - compensated)) AS outstanding,
          SUM(error <> '') AS errors
        ${scope} GROUP BY ${expression} ORDER BY ${order}
      `);
      breakdown = groups.map(group => ({
        key: String(group.group_key), count: Number(group.count),
        claimed: Number(group.claimed), compensated: Number(group.compensated),
        outstanding: Number(group.outstanding), errors: Number(group.errors),
      }));
    }
    const rows = await query(`SELECT * ${filtered} ORDER BY date DESC, id, hn LIMIT ? OFFSET ?`,[...args,f.exportAll?10000:10,f.exportAll?0:(f.page-1)*10]);
    const normalized = rows.map(normalizeReportRow);
    return { rows:normalized, total:Number(sums.count), summary:{count:Number(sums.count),claimed:Number(sums.claimed),compensated:Number(sums.compensated),outstanding:Number(sums.outstanding),errors:Number(sums.errors)},funds:funds.map(r=>({name:String(r.name),value:Number(r.value),count:Number(r.count)})),trend:trend.map(r=>({month:String(r.month),claimed:Number(r.claimed),compensated:Number(r.compensated)})),mode:'live',updatedAt:new Date().toISOString(), breakdown };
  });
}

const batchSize = 2000;
function exportJob(filters: Filters): ExportJob {
  const report = reports.find(item => item.id === filters.report)!;
  return {
    id: report.id, title: report.name, source: report.source, columns: reportColumns,
    writeRows: async (signal, write) => {
      if (demo) {
        const result = getDemo(filters.report, filters.start, filters.end, filters.fund, filters.service, filters.q, filters.status, 1, undefined, true);
        await write(result.rows.map(reportCells));
        return;
      }
      await withReportScope(filters, async ({ query, filtered, args }) => {
        for (let offset = 0; ; offset += batchSize) {
          signal.throwIfAborted();
          const batch = await query(
            `SELECT * ${filtered} ORDER BY date DESC, id, hn, service, fund, claimed, compensated, error LIMIT ? OFFSET ?`,
            [...args, batchSize, offset],
          );
          if (batch.length) await write(batch.map(normalizeReportRow).map(reportCells));
          if (batch.length < batchSize) break;
        }
      });
    },
  };
}

async function withLegacyScope<T>(report: LegacyReport, run: (query: Query) => Promise<T>) {
  const conn = await poolFor(report.rep ? 'RCM' : 'HOSXP').getConnection();
  try {
    await conn.query('START TRANSACTION READ ONLY');
    return await run(async (sql, values = []) => (await conn.execute<RowDataPacket[]>({ sql, timeout: 25000 }, values))[0]);
  } finally { await conn.rollback().catch(() => {}); conn.release(); }
}

function legacyCells(report: LegacyReport, rows: RowDataPacket[], offset: number) {
  return rows.map((row, index) => report.columns.map(column => {
    if (report.rep?.numbered && column === 'no') return offset + index + 1;
    if (column === 'คน' || column === 'เคส') return Number(row.cases);
    return row[column] ?? null;
  }));
}

function legacyExportJob(report: LegacyReport, dates: { start: string; end: string }): ExportJob {
  return {
    id: report.id, title: report.title, source: report.rep ? 'RCM REP · วันที่ส่งเบิก' : 'HOSxP · ข้อมูลอ้างอิงทุกแถว', columns: [...report.columns],
    writeRows: async (signal, write) => {
      if (demo) throw new Error(report.rep ? 'รายงานนี้ต้องเชื่อมฐาน RCM' : 'รายงานนี้ต้องเชื่อมฐาน HOSxP');
      const { sql, args } = legacyQuery(report, dates);
      await withLegacyScope(report, async query => {
        for (let offset = 0; ; offset += batchSize) {
          signal.throwIfAborted();
          const rows = await query(sql + ' LIMIT ? OFFSET ?', [...args, batchSize, offset]);
          if (rows.length) await write(legacyCells(report, rows, offset));
          if (rows.length < batchSize) break;
        }
      });
    },
  };
}

function legacyDefinition(params: URLSearchParams) {
  const report = legacyReports.find(item => item.id === params.get('legacy'));
  if (!report) throw new Error('ไม่พบรายงานต้นฉบับ');
  return report;
}

function json(res:ServerResponse,code:number,value:unknown) {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
function redirect(res: ServerResponse, path: string) {
  res.writeHead(302, { Location: path, 'Cache-Control': 'no-store' });
  res.end();
}

async function login(req: IncomingMessage, res: ServerResponse) {
  let body: Awaited<ReturnType<typeof readLogin>>;
  try { body = await readLogin(req); }
  catch { return json(res, 400, { error: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง' }); }
  if (demo) {
    if (body.demo !== true) return json(res, 400, { error: 'เว็บกำลังทำงานในโหมดทดลอง' });
    if (!limitLogin(req, 'demo')) return json(res, 429, { error: 'ลองเข้าสู่ระบบใหม่ในอีกสักครู่' });
    signIn(req, res, 'ทดลองใช้งาน', secureCookie);
    return json(res, 200, { ok: true });
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password || username.length > 250 || password.length > 512)
    return json(res, 400, { error: 'กรุณากรอกรหัสผู้ใช้และรหัสผ่าน HOSxP' });
  if (!limitLogin(req, username)) return json(res, 429, { error: 'ลองเข้าสู่ระบบใหม่ในอีกสักครู่' });
  try {
    const account = await authenticateHosxp(poolFor('HOSXP'), username, password);
    if (!account) return json(res, 401, { error: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีไม่มีสิทธิ์' });
    signIn(req, res, account, secureCookie);
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 503, { error: 'ติดต่อระบบบัญชี HOSxP ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล' });
  }
}

const mime: Record<string,string> = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server=createServer(async (req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
  let url: URL;
  try { url = new URL(req.url || '/', 'http://localhost'); }
  catch { return json(res, 400, { error: 'Invalid request' }); }
  const isRead = req.method === 'GET' || req.method === 'HEAD';
  const isLoginPage = url.pathname === '/login' || url.pathname === '/login/';
  if(isRead && url.pathname==='/api/health') return json(res,200,{ok:true});
  if(isRead && url.pathname==='/api/auth/mode') return json(res,200,{demo});
  if(url.pathname==='/api/auth/login' || url.pathname==='/api/auth/logout') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    if (req.headers['sec-fetch-site'] === 'cross-site' || req.headers['content-type']?.split(';')[0] !== 'application/json')
      return json(res, 415, { error: 'Invalid request' });
    if (url.pathname.endsWith('/login')) return login(req, res);
    signOut(req, res, secureCookie);
    return json(res, 200, { ok: true });
  }
  if(!isRead) return json(res,405,{error:'Method not allowed'});
  const user = currentUser(req);
  if (isLoginPage && user) return redirect(res, '/');
  if (!user && !isLoginPage && !url.pathname.startsWith('/_next/static/')) {
    if (url.pathname.startsWith('/api/')) return json(res, 401, { error: 'กรุณาเข้าสู่ระบบ' });
    return redirect(res, '/login/');
  }
  if(url.pathname==='/api/status'){json(res,200,{demo,rcm:configured('RCM'),hosxp:configured('HOSXP'),user});return;}
  if (url.pathname === '/api/reports/export' || url.pathname === '/api/reports/legacy') {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    try {
      if (url.pathname.endsWith('/legacy')) {
        const report = legacyDefinition(url.searchParams);
        if (demo) return json(res, 409, { error: report.rep ? 'รายงานนี้ต้องเชื่อมฐาน RCM' : 'รายงานนี้ต้องเชื่อมฐาน HOSxP' });
        const page = Number(url.searchParams.get('page') ?? 1);
        if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error('เลขหน้าไม่ถูกต้อง');
        const offset = (page - 1) * 50;
        const { sql, args } = legacyQuery(report, parseFilters(url.searchParams));
        const rows = await withLegacyScope(report, query => query(sql + ' LIMIT ? OFFSET ?', [...args, 51, offset]));
        return json(res, 200, { columns: report.columns, rows: legacyCells(report, rows.slice(0, 50), offset), hasNext: rows.length > 50 });
      }
      const filters = parseFilters(url.searchParams);
      const all = url.searchParams.get('all') === '1';
      const jobs = all
        ? [...reports.map(report => exportJob({ ...filters, report: report.id, fund: '', service: '', q: '', status: '' })), ...legacyReports.map(report => legacyExportJob(report, filters))]
        : [url.searchParams.has('legacy') ? legacyExportJob(legacyDefinition(url.searchParams), filters) : exportJob(filters)];
      await sendReports(res, jobs, { all, start: filters.start, end: filters.end, demo });
      return;
    } catch (error) {
      if (res.destroyed) return;
      if (res.headersSent) { res.destroy(); return; }
      const code = (error as { code?: string }).code;
      const message = code ? 'ส่งออกหรืออ่านรายงานไม่สำเร็จ กรุณาตรวจฐานและโครงสร้างตาราง'
        : error instanceof Error ? error.message : 'อ่านรายงานไม่สำเร็จ';
      return json(res, error instanceof ExportBusy ? 429 : 400, { error: message });
    }
  }
  if(url.pathname==='/api/reports'){
    try { const f=parseFilters(url.searchParams);let result:ReportData;
      if(demo) result=getDemo(f.report,f.start,f.end,f.fund,f.service,f.q,f.status,f.page,f.groupBy ?? undefined,f.exportAll);
      else result=await liveReport(f);
      json(res,200,result);
    }catch(e){const code=(e as {code?:string}).code;const message=code ? ({ER_ACCESS_DENIED_ERROR:'ฐานข้อมูลปฏิเสธบัญชีผู้ใช้ กรุณาตรวจสอบ .env',ECONNREFUSED:'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบ Host, Port และเครือข่าย',ETIMEDOUT:'หมดเวลาเชื่อมต่อฐานข้อมูล',ER_NO_SUCH_TABLE:'ไม่พบตารางรายงานในฐานข้อมูลที่ตั้งค่า',ER_TABLEACCESS_DENIED_ERROR:'บัญชีผู้ใช้ไม่มีสิทธิ SELECT ตารางรายงาน'}[code] || 'ฐานข้อมูลไม่สามารถประมวลผลรายงานนี้ได้ กรุณาตรวจสอบการตั้งค่าและเวอร์ชันโครงสร้าง') : e instanceof Error ? e.message : 'โหลดรายงานไม่สำเร็จ';json(res,400,{error:message});}return;
  }
  if(url.pathname.startsWith('/api/')){json(res,404,{error:'Not found'});return;}
  if (nextHandler) {
    try { await nextHandler(req, res); }
    catch {
      if (!res.headersSent) json(res, 500, { error: 'เปิดหน้าเว็บสำหรับพัฒนาไม่สำเร็จ' });
      else res.end();
    }
    return;
  }
  try { const decoded=decodeURIComponent(url.pathname);let path=resolve(root,'.'+decoded);if(path!==root&&!path.startsWith(root+sep))throw new Error();if((await stat(path)).isDirectory())path=resolve(path,'index.html');const content=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':path.includes('_next')?'public, max-age=31536000, immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:content);}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('ไม่พบหน้าที่ต้องการ');}
});
async function start() {
  await nextApp?.prepare();
  if (nextApp) server.on('upgrade', nextApp.getUpgradeHandler());
  server.listen(port, host, () => {
    console.log(`RCM Report Studio · ${demo ? 'DEMO' : 'LIVE'}\nLocal: http://${host}:${port}`);
    if (development) {
      const modeSource = Object.hasOwn(fileSettings, 'DEMO_MODE') ? '.env'
        : modeSetting ? 'process environment' : 'default';
      console.log(`Dev config: ${envPath}\nMode source: ${modeSource} · HOSxP: ${configured('HOSXP') ? 'configured' : 'missing settings'} · RCM: ${configured('RCM') ? 'configured' : 'missing settings'}`);
    }
  });
}
start().catch(error => { console.error(error); process.exitCode = 1; });
const shutdown=()=>{server.close();Promise.all(prefixes.map(p=>pools.get(p)?.end())).finally(()=>process.exit(0));};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
