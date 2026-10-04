import type { Metadata } from 'next';
import { appInfo } from '@/lib/app-info';
import './globals.css';

export const metadata: Metadata = {
  title: appInfo.name,
  description: appInfo.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
