import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Monitor | Real-time Dashboard',
  description: 'Real-time system monitoring dashboard for CPU, memory, disk, network, and NVIDIA GPU telemetry.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
