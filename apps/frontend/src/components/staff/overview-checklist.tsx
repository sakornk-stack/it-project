import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Info,
  MinusCircle,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BADGE_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';

export interface ChecklistItem {
  key: string;
  icon: LucideIcon;
  // How urgent the row is: colours the icon tile, never the only cue (the title says it too).
  tone: SemanticTone;
  title: string;
  description: string;
  action?: { href: string; label: string };
}

export const CHECK_ICONS = {
  noData: MinusCircle,
  critical: AlertTriangle,
  noInstructor: UserX,
  noClo: BookOpen,
};

const ROW_BASE =
  'flex min-h-11 items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 outline-none';

// The border takes the row's own level on hover and on keyboard focus.
const BORDER_ON_HOVER: Record<SemanticTone, string> = {
  danger: '[@media(hover:hover)]:hover:border-red-300 focus-visible:border-red-300',
  warning: '[@media(hover:hover)]:hover:border-amber-300 focus-visible:border-amber-300',
  success: '[@media(hover:hover)]:hover:border-emerald-300 focus-visible:border-emerald-300',
  neutral: '[@media(hover:hover)]:hover:border-slate-300 focus-visible:border-slate-300',
};

// Rows with a count of zero are not passed in, so an empty list means there is
// nothing to check. A row without an action is information only: it names
// something Staff cannot fix themselves.
export function OverviewChecklist({ items }: Readonly<{ items: ChecklistItem[] }>) {
  const actionable = items.filter((item) => item.action).length;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-lg">สิ่งที่ควรตรวจสอบ</CardTitle>
          {actionable > 0 && (
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 text-xs font-semibold tabular-nums text-red-700">
              <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
              {actionable} รายการรอดำเนินการ
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีรายการที่ต้องตรวจสอบในขอบเขตนี้</p>
        ) : (
          <ul className="space-y-2">
            {items.map(({ key, icon: Icon, tone, title, description, action }) => {
              const body = (
                <>
                  <span className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                        BADGE_TONE_CLASSES[tone],
                      )}
                    >
                      <Icon aria-hidden="true" size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words font-semibold text-primary">{title}</span>
                      <span className="block break-words text-sm text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </span>
                  {action ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors [@media(hover:hover)]:group-hover:text-primary group-focus-visible:text-primary">
                      <span className="hidden sm:inline">{action.label}</span>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:translate-x-0 motion-reduce:transition-none"
                      />
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Info aria-hidden="true" className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">ข้อมูลเพื่อทราบ</span>
                    </span>
                  )}
                </>
              );
              return (
                <li key={key}>
                  {action ? (
                    <Link
                      href={action.href}
                      aria-label={`${title} ${action.label}`}
                      className={cn(
                        ROW_BASE,
                        'group interactive-row border border-transparent',
                        BORDER_ON_HOVER[tone],
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={ROW_BASE}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
