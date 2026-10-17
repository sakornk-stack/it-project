import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/layout/reveal';
import { BADGE_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';

// The one "no access" view for every role's pages. Render it inside the viewer's own shell
// (AccessDeniedPage in layout/page-states.tsx does) so the menu and header stay put and the
// way back is obvious. `description` says who the page is for; the button goes to the viewer's
// own home, so pass the href resolved from their roles.
export function AccessDenied({
  description,
  homeHref,
  className,
}: Readonly<{ description: ReactNode; homeHref: string; className?: string }>) {
  return (
    <Reveal index={0}>
      <section
        aria-labelledby="access-denied-title"
        className={cn(
          'mx-auto flex max-w-lg flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center shadow-sm',
          className,
        )}
      >
        <span
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full border',
            BADGE_TONE_CLASSES.warning,
          )}
        >
          <Lock size={24} aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 id="access-denied-title" className="text-xl font-semibold text-primary">
            ไม่มีสิทธิ์เข้าถึงหน้านี้
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={homeHref}>กลับไปแดชบอร์ดของคุณ</Link>
        </Button>
      </section>
    </Reveal>
  );
}
