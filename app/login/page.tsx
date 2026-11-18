'use client';

import { useEffect, useState, type FormEvent } from 'react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/auth/mode', { cache: 'no-store' }).then(response => response.json())
      .then(mode => setDemo(mode.demo === true)).catch(() => {});
  }, []);

  async function login(event: FormEvent<HTMLFormElement>, sample = false) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sample ? { demo: true } : { username, password }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }
      window.location.replace('/');
    } catch {
      setError('เชื่อมต่อเว็บไม่ได้ กรุณาลองอีกครั้ง');
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  return <main className="flex min-h-dvh items-center justify-center px-4 py-12">
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="bg-[#152d32] px-7 py-7 text-white">
        <p className="text-2xl font-semibold">rcm<span className="text-[#a3c5b7]">.</span></p>
        <p className="mt-1 text-xs text-[#b0c5c6]">ศูนย์รายงานการเงิน</p>
      </div>
      <div className="p-7">
        <h1 className="text-xl font-semibold">เข้าสู่ระบบ</h1>
        <p className="mb-6 mt-2 text-xs leading-5 text-muted">{demo ? 'โหมดทดลองใช้ข้อมูลตัวอย่าง' : 'ใช้รหัสผู้ใช้และรหัสผ่านบัญชี HOSxP ของคุณ'}</p>
        <form method="post" className="space-y-4" onSubmit={event => login(event, demo)}>
          {!demo && <>
            <label className="block text-xs font-medium">รหัสผู้ใช้ HOSxP
              <input name="username" autoComplete="username" required maxLength={250} value={username}
                onChange={event => setUsername(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5" />
            </label>
            <label className="block text-xs font-medium">รหัสผ่าน
              <input name="password" type="password" autoComplete="current-password" required maxLength={512} value={password}
                onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5" />
            </label>
          </>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand px-4 py-3 text-xs font-semibold text-white">
            {busy ? 'กำลังเข้าสู่ระบบ…' : demo ? 'เข้าโหมดทดลอง' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  </main>;
}
