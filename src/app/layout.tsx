import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import { Toaster } from 'react-hot-toast';
import ThemeProvider from '@/components/ThemeProvider';
import LanguageProvider from '@/components/LanguageProvider';

export const metadata: Metadata = {
  title: 'PsychoVoice Chess — Play Beyond the Board',
  description: 'A next-gen chess platform that analyzes your mind through your moves and your voice.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <Header />
            <main className="min-h-[calc(100vh-72px)]">{children}</main>
            <Toaster position="top-right" />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
