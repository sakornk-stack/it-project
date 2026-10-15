'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

// The icon is chosen with CSS (the `dark` class on <html>), not React state:
// the server cannot know the stored theme, so a state-driven icon would
// mismatch on hydration.
export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const { toggleTheme } = useTheme();
  const label = 'สลับโหมดมืด/สว่าง';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Moon size={18} className="dark:hidden" aria-hidden="true" />
      <Sun size={18} className="hidden dark:block" aria-hidden="true" />
    </button>
  );
}
