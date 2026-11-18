import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'RCM — Report Studio', description: 'ศูนย์รายงานรายได้และการชดเชยค่ารักษาพยาบาล RCM / HOSxP' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
