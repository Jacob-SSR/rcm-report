import { createReadStream } from 'node:fs';
import { mkdtemp, open, rm, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { ZipFile } from 'yazl';
import type { Row } from './reports';

type Cell = string | number | boolean | null | undefined;
export const reportColumns = ['เลขที่', 'วันที่', 'HN', 'ประเภท', 'สิทธิ', 'เรียกเก็บ', 'ชดเชย/ชำระ', 'ส่วนต่างคงเหลือ', 'สถานะ', 'รหัสข้อผิดพลาด'];
export function reportCells(row: Row): Cell[] {
  return [row.id, row.date, row.hn, row.service, row.fund, row.claimed, row.compensated,
    Math.max(0, row.claimed - row.compensated), row.status, row.error];
}
export function csvLine(cells: Cell[]) {
  return cells.map(cell => {
    let text = String(cell ?? '');
    if (typeof cell === 'string' && /^\s*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',') + '\r\n';
}

export type ExportJob = {
  id: string;
  title: string;
  source: string;
  columns: string[];
  writeRows: (signal: AbortSignal, write: (batch: Cell[][]) => Promise<void>) => Promise<void>;
};

let running = 0;
export class ExportBusy extends Error {}
export async function sendReports(res: ServerResponse, jobs: ExportJob[], options: {
  all: boolean; start: string; end: string; demo: boolean;
}) {
  if (running >= 2) throw new ExportBusy('กำลังส่งออกรายงานอยู่ กรุณาลองใหม่อีกครั้ง');
  running++;
  let folder: string | undefined;
  const controller = new AbortController();
  const onClose = () => controller.abort();
  res.once('close', onClose);
  try {
    folder = await mkdtemp(join(tmpdir(), 'rcm-export-'));
    const manifest: Cell[][] = [['รายงาน', 'แหล่งข้อมูล', 'โหมด', 'ไฟล์', 'รายการ', 'สถานะ']];
    const files: {path: string; name: string}[] = [];
    for (const job of jobs) {
      controller.signal.throwIfAborted();
      const name = job.id + (options.demo ? '-DEMO' : '') + '.csv';
      const path = join(folder, name);
      try {
        const handle = await open(path, 'wx', 0o600);
        let count = 0;
        try {
          await handle.writeFile('\uFEFF' + csvLine(job.columns));
          await job.writeRows(controller.signal, async batch => {
            controller.signal.throwIfAborted();
            await handle.writeFile(batch.map(csvLine).join(''));
            count += batch.length;
          });
        } finally { await handle.close(); }
        files.push({ path, name });
        manifest.push([job.title, job.source, options.demo ? 'DEMO' : 'LIVE', name, count, 'สำเร็จ']);
      } catch (error) {
        if (!options.all || controller.signal.aborted) throw error;
        manifest.push([job.title, job.source, options.demo ? 'DEMO' : 'LIVE', '', null, 'ส่งออกไม่สำเร็จ กรุณาตรวจฐานและโครงสร้างตาราง']);
      }
    }
    controller.signal.throwIfAborted();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-RCM-Export-Failed', String(jobs.length - files.length));
    if (options.all) {
      const zip = new ZipFile();
      zip.on('error', error => res.destroy(error));
      for (const file of files) zip.addFile(file.path, file.name);
      zip.addBuffer(Buffer.from('\uFEFF' + manifest.map(csvLine).join('')), 'export-status.csv');
      const name = `RCM-all-${options.start}-${options.end}${options.demo ? '-DEMO' : ''}.zip`;
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      res.setHeader('Content-Type', 'application/zip');
      const done = pipeline(zip.outputStream, res, { signal: controller.signal });
      zip.end();
      await done;
    } else {
      const file = files[0];
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Length', (await stat(file.path)).size);
      await pipeline(createReadStream(file.path), res, { signal: controller.signal });
    }
  } finally {
    res.off('close', onClose);
    running--;
    if (folder) await rm(folder, { recursive: true, force: true }).catch(() => {});
  }
}
