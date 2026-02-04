import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: {
    default: 'Agent Civilization',
    template: 'Agent Civ — %s',
  },
  description: 'Watch three AI civilizations compete via natural language diplomacy on an isometric map.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f1219'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`dark ${dmSans.variable}`} lang="en">
      <body className="bg-gray-950 text-white antialiased font-sans overflow-hidden">
        {children}
      </body>
    </html>
  );
}