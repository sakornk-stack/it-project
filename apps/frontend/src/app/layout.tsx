import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import '../styles/theme-palette.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { BRAND_NAME } from '@/lib/brand';
import { QueryProvider } from '@/lib/query-client';
import { ThemeProvider } from '@/lib/theme-context';
import { THEME_INIT_SCRIPT } from '@/lib/theme-script';
import { ToastProvider } from '@/lib/toast-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionTimeoutGuard } from '@/components/auth/session-timeout-guard';

// Thai + Latin in one family; exposed as --font-sans and picked up by tailwind's font-sans.
const plexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: 'Academic progress tracking and learning outcome analytics system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script below adds the `dark` class
    // to <html> before React hydrates.
    <html lang="th" className={plexSansThai.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <QueryProvider>
              <AuthProvider>
                <TooltipProvider delayDuration={200}>
                  {children}
                  <SessionTimeoutGuard />
                </TooltipProvider>
              </AuthProvider>
            </QueryProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
