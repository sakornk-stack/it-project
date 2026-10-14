import type { Metadata } from 'next';
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
    <html lang="th" suppressHydrationWarning>
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
