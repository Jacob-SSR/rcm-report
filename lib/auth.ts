import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool, RowDataPacket } from 'mysql2/promise';

const sessionLifetime = 8 * 60 * 60;
const cookieName = 'rcm_session';
const sessions = new Map<string, { username: string; expires: number }>();
const attempts = new Map<string, { count: number; expires: number }>();
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id);
  for (const [key, attempt] of attempts) if (attempt.expires <= now) attempts.delete(key);
}, 60_000);
sweep.unref();

const token = (req: IncomingMessage) => req.headers.cookie?.match(/(?:^|;\s*)rcm_session=([a-f0-9]{64})(?:;|$)/)?.[1] ?? '';
export function currentUser(req: IncomingMessage) {
  const session = sessions.get(token(req));
  return session && session.expires > Date.now() ? session.username : undefined;
}
function setCookie(res: ServerResponse, id: string, age: number, secure: boolean) {
  res.setHeader('Set-Cookie', `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`);
}
export function signOut(req: IncomingMessage, res: ServerResponse, secure: boolean) {
  sessions.delete(token(req));
  setCookie(res, '', 0, secure);
}
export function signIn(req: IncomingMessage, res: ServerResponse, username: string, secure: boolean) {
  sessions.delete(token(req));
  const id = randomBytes(32).toString('hex');
  sessions.set(id, { username, expires: Date.now() + sessionLifetime * 1000 });
  setCookie(res, id, sessionLifetime, secure);
}

export function limitLogin(req: IncomingMessage, username: string) {
  const now = Date.now();
  const address = req.socket.remoteAddress ?? '';
  const limits = [[`ip:${address}`, 40], [`user:${username.toLowerCase()}`, 8]] as const;
  const history = limits.map(([key, max]) => {
    const previous = attempts.get(key);
    return { key, max, value: previous && previous.expires > now ? previous : { count: 0, expires: now + 5 * 60_000 } };
  });
  if (attempts.size > 10_000 || history.some(({ max, value }) => value.count >= max)) return false;
  for (const { key, value } of history) attempts.set(key, { ...value, count: value.count + 1 });
  return true;
}

export async function readLogin(req: IncomingMessage): Promise<{ username?: unknown; password?: unknown; demo?: unknown }> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of req) {
    const bytes = Buffer.from(part);
    size += bytes.length;
    if (size > 4096) throw new Error('ข้อมูลเข้าสู่ระบบยาวเกินกำหนด');
    parts.push(bytes);
  }
  const body: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  return body;
}

export async function authenticateHosxp(pool: Pool, username: string, password: string): Promise<string | undefined> {
  // HOSxP web passwords are stored as hexadecimal MD5 in opduser.passweb.
  // Compare in MySQL so hashes are never returned to the web server.
  const digest = createHash('md5').update(password, 'utf8').digest('hex');
  const groups = new Set((process.env.HOSXP_LOGIN_GROUPS ?? '').split(',').map(group => group.trim().toLowerCase()).filter(Boolean));
  const groupColumn = groups.size ? ', groupname' : '';
  const [rows] = await pool.execute<RowDataPacket[]>({
    sql: `SELECT loginname${groupColumn} FROM opduser
      WHERE loginname = ? AND BINARY LOWER(TRIM(passweb)) = ?
        AND UPPER(TRIM(COALESCE(account_disable, ''))) NOT IN ('Y', '1', 'T', 'TRUE')
      LIMIT 1`,
    timeout: 7000,
  }, [username, digest]);
  const account = rows[0];
  if (!account || (groups.size && !groups.has(String(account.groupname ?? '').trim().toLowerCase()))) return undefined;
  return String(account.loginname);
}
