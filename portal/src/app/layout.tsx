import { Analytics } from "@vercel/analytics/next"
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GREEDYLM Portal',
  description: 'Decentralized AI Agent Network',
  verification: {
    google: 'g3QKQayj9ptPNUYp-YP7CG5mBasjx53IYmHrlgWE2VI',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-slate-50 min-h-screen`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
