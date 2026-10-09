import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GlobalPlayer } from '@/components/music/global-player';
import { IntroGate } from '@/components/intro-gate';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
const introStorageCheck = `
  try {
    if (localStorage.getItem('gymos_intro_seen') !== 'true') {
      document.documentElement.setAttribute('data-gymos-intro-pending', '');
      document.documentElement.setAttribute('data-gymos-intro-active', '');
    }
  } catch (error) {
    console.error('Unable to check whether the Gym OS intro was already seen.', error);
  }
`;

export const metadata: Metadata = {
  title: 'Gym OS',
  description: 'Manage your members, attendance, memberships, payments and daily gym operations — all in one place.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introStorageCheck }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <IntroGate>
          {children}
          {/* Global gym music player — persists across all routes */}
          <GlobalPlayer />
        </IntroGate>
      </body>
    </html>
  );
}
