import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import type { Headline, HeadlineTone } from '@/lib/instructor-portfolio';
import { cn } from '@/lib/utils';

// One calm sentence at the top: amber while a course is short of its bar (a
// to-do, never an alarm), green-tinted when none is. Icon and words, not colour alone.
const TONE: Record<HeadlineTone, { box: string; tile: string; icon: LucideIcon }> = {
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-800',
    tile: 'bg-amber-100 text-amber-700',
    icon: AlertTriangle,
  },
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    tile: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
  },
  neutral: {
    box: 'border-slate-200 bg-slate-50 text-slate-700',
    tile: 'bg-slate-100 text-slate-600',
    icon: Info,
  },
};

export function HeadlineBanner({ headline }: Readonly<{ headline: Headline }>) {
  const { box, tile, icon: Icon } = TONE[headline.tone];
  return (
    <section
      aria-label="สรุปภาพรวม"
      className={cn('flex items-center gap-3 rounded-2xl border px-4 py-4 sm:gap-4 sm:px-6', box)}
    >
      <span
        aria-hidden="true"
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tile)}
      >
        <Icon size={22} />
      </span>
      <p className="min-w-0 break-words text-base leading-relaxed sm:text-[17px]">
        <strong className="font-bold">{headline.lead}</strong>
        {headline.rest}
      </p>
    </section>
  );
}
