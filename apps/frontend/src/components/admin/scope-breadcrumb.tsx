import { Building2, ChevronRight, GraduationCap, Landmark, type LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card } from '@/components/ui/card';

const LEVELS: { key: 'faculty' | 'department' | 'program'; icon: LucideIcon; unit: string }[] = [
  { key: 'faculty', icon: Landmark, unit: 'คณะ' },
  { key: 'department', icon: Building2, unit: 'ภาควิชา' },
  { key: 'program', icon: GraduationCap, unit: 'สาขา' },
];

// Faculty › department › program counts as one trail, so the hierarchy reads as a path
// instead of three unrelated cards. The "›" marks are decoration; the list order and the
// unit words carry the meaning.
export function ScopeBreadcrumb({
  counts,
}: Readonly<{ counts: Record<'faculty' | 'department' | 'program', number> }>) {
  return (
    <Card>
      <nav aria-label="ลำดับหน่วยงานในขอบเขตของคุณ" className="p-3 sm:p-4">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {LEVELS.map(({ key, icon: Icon, unit }, index) => (
            <li key={key} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground" />
              )}
              <span className="flex items-center gap-2 rounded-lg bg-brand-light px-3 py-2">
                <Icon size={16} aria-hidden="true" className="text-brand" />
                <span className="text-lg font-semibold tabular-nums text-primary">
                  <AnimatedNumber value={counts[key]} />
                </span>
                <span className="text-sm text-muted-foreground">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      </nav>
    </Card>
  );
}
