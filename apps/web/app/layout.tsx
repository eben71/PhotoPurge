import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'PhotoPrune',
  description: 'Skeleton app for PhotoPrune Phase 0'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
