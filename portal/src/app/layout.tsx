import { Analytics } from "@vercel/analytics/next"
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GREEDYLM Portal',
  description: 'Decentralized AI Agent Network',
  verification: {
    google: 'mvFT6O9TsWNDmhFUag33UIkTCtSVgY2T5Xz5D3ie5OQ',
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
        <Providers>
          <Navbar />
          <div className="pt-14">
            {children}
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
