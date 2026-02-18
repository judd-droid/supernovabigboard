import './globals.css';
import type { Metadata } from 'next';
import { AuthGate } from '@/components/AuthGate';

export const metadata: Metadata = {
  title: 'New Business Dashboard',
  description: 'Sales dashboard for new business performance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
