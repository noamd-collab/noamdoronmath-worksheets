import type { Metadata } from 'next';
import { Assistant, Heebo } from 'next/font/google';
import './globals.css';

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-assistant',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['500', '700', '800', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'דפי עבודה · כיתה ז׳ (אב־טיפוס Headless)',
  description: 'אב־טיפוס קטלוג דפי עבודה לכיתה ז׳ — קורא את חוזה הנתונים catalog.v1.json',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} ${heebo.variable}`}>
      <body style={{ fontFamily: 'var(--font-assistant), var(--font-heebo), Arial, sans-serif' }}>
        <a className="skip-link" href="#topic-list">
          דילוג לתוכן
        </a>
        {children}
      </body>
    </html>
  );
}
