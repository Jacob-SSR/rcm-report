export type ClaimFileRow = { id: string; cents: number };
export type ClaimFile = { rows: ClaimFileRow[]; issues: string[] };

function readCsv(text: string): string[][] {
  const records: string[][] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') { field += '"'; index++; }
      else { quoted = false; closed = true; }
      continue;
    }
    if (char === ',' || char === '\r' || char === '\n') {
      cells.push(field);
      field = '';
      closed = false;
      if (char !== ',') {
        if (char === '\r' && text[index + 1] === '\n') index++;
        records.push(cells);
        cells = [];
      }
      continue;
    }
    if (closed || (char === '"' && field)) throw new Error('เครื่องหมายคำพูดใน CSV ผิดรูปแบบ');
    if (char === '"') quoted = true;
    else field += char;
  }
  if (quoted) throw new Error('พบช่อง CSV ที่เปิดเครื่องหมายคำพูดค้างไว้');
  if (cells.length || field || closed) records.push([...cells, field]);
  return records;
}

export function parseClaimFile(text: string, mode: 'claimed' | 'paid'): ClaimFile {
  const records = readCsv(text.replace(/^\uFEFF/, ''));
  const header = records.shift()?.map(value => value.trim().toLowerCase()) ?? [];
  const idNames = ['claim_id', 'id', 'eclaimno', 'เลขที่'];
  const amountNames = mode === 'claimed' ? ['claimed', 'collected', 'เรียกเก็บ'] : ['paid', 'compensated', 'ชดเชย/ชำระ'];
  const idIndex = header.findIndex(name => idNames.includes(name));
  const amountIndex = header.findIndex(name => amountNames.includes(name));
  if (idIndex < 0 || amountIndex < 0) throw new Error(`ต้องมีคอลัมน์ claim_id และ ${mode}`);
  const issues: string[] = [];
  const rows: ClaimFileRow[] = [];
  const seen = new Set<string>();
  records.forEach((cells, index) => {
    if (cells.every(value => !value.trim())) return;
    const rowNumber = index + 2;
    const id = cells[idIndex]?.trim();
    const raw = cells[amountIndex]?.trim() ?? '';
    const amount = raw.replaceAll(',', '');
    if (cells.length !== header.length || !id || !/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) {
      issues.push(`ระเบียน ${rowNumber} มีคอลัมน์ เลขที่ หรือยอดเงินไม่ถูกต้อง`);
      return;
    }
    const [whole, fractional = ''] = amount.replace(/^-/, '').split('.');
    const cents = (Number(whole) * 100 + Number(fractional.padEnd(2, '0'))) * (amount.startsWith('-') ? -1 : 1);
    if (!Number.isSafeInteger(cents) || Math.abs(cents) > 1e10) {
      issues.push(`ระเบียน ${rowNumber} มียอดเงินเกินขอบเขตที่ตรวจสอบได้`);
      return;
    }
    if (seen.has(id)) {
      issues.push(`ระเบียน ${rowNumber} มีเลขที่รายการซ้ำ`);
      return;
    }
    seen.add(id);
    rows.push({ id, cents });
  });
  if (!rows.length && !issues.length) issues.push('ไฟล์ไม่มีรายการ');
  return { rows, issues };
}

export function reconcileClaims(claimed: ClaimFileRow[], paid: ClaimFileRow[]) {
  const left = new Map(claimed.map(row => [row.id, row.cents]));
  const right = new Map(paid.map(row => [row.id, row.cents]));
  return [...new Set([...left.keys(), ...right.keys()])].map(id => {
    const requested = left.get(id);
    const received = right.get(id);
    const difference = (requested ?? 0) - (received ?? 0);
    const status = requested === undefined ? 'พบเฉพาะฝั่งตอบกลับ'
      : received === undefined ? 'ยังไม่มีรายการตอบกลับ'
      : difference > 0 ? 'รับชำระต่ำกว่ายอดเรียกเก็บ'
      : difference < 0 ? 'รับชำระสูงกว่ายอดเรียกเก็บ' : 'ยอดตรงกัน';
    return { id, requested, received, difference, status };
  });
}

export function reconcileCsv(rows: ReturnType<typeof reconcileClaims>) {
  const encode = (value: string | number | undefined) => {
    const text = String(value ?? '');
    const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [
    ['claim_id', 'claimed', 'paid', 'difference', 'status'],
    ...rows.map(row => [row.id, row.requested === undefined ? undefined : row.requested / 100,
      row.received === undefined ? undefined : row.received / 100, row.difference / 100, row.status]),
  ].map(row => row.map(encode).join(',')).join('\r\n');
}
