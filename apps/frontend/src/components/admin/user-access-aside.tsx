import {
  CalendarDays,
  CheckCircle2,
  Clock,
  IdCard,
  Info,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import type { AccessLimitation } from '@/lib/admin-user-guard';
import { formatThaiDate } from '@/lib/admin-users';
import { cn } from '@/lib/utils';
import { DetailSectionHeader } from '@/components/ui/detail-section-header';
import { Card, CardContent } from '@/components/ui/card';

// formatThaiDate answers an em dash for a missing/invalid date; this card shows a plain "-".
function dateOrDash(iso: string): string {
  const formatted = formatThaiDate(iso);
  return formatted === '—' ? '-' : formatted;
}

// Only what holds the viewer back on this account; when nothing does, one calm line.
function AccessCard({ limitations }: Readonly<{ limitations: AccessLimitation[] }>) {
  // Amber only when something is actually switched off; an advisory line stays green.
  const limited = limitations.some((limitation) => limitation.disabled.length > 0);
  return (
    <Card
      className={cn(
        'transition-colors duration-150 motion-reduce:transition-none',
        limited ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50',
      )}
    >
      <DetailSectionHeader
        icon={limited ? ShieldAlert : ShieldCheck}
        title="สิทธิ์ของคุณกับบัญชีนี้"
      />
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <ul className="space-y-3">
          {limitations.length === 0 && (
            <li className="flex items-start gap-2.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              คุณจัดการบัญชีนี้ได้
            </li>
          )}
          {limitations.map((limitation) => (
            <li key={limitation.key} className="flex items-start gap-2.5">
              {limitation.disabled.length > 0 ? (
                <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" />
              ) : (
                <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="course-name-break text-sm font-medium">{limitation.reason}</p>
                {limitation.disabled.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ปิดอยู่: {limitation.disabled.join(' · ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: Readonly<{ icon: LucideIcon; label: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Icon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="course-name-break ml-auto min-w-0 text-right text-sm font-medium tabular-nums">
        {children}
      </dd>
    </div>
  );
}

// Facts the API holds that the profile card above does not already show. The
// API has no last-sign-in time, so none is shown.
function AccountInfoCard({ user }: Readonly<{ user: AdminUserSummary }>) {
  return (
    <Card>
      <DetailSectionHeader icon={IdCard} title="ข้อมูลบัญชี" />
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <dl className="space-y-3">
          <Fact icon={CalendarDays} label="สร้างบัญชีเมื่อ">
            {dateOrDash(user.createdAt)}
          </Fact>
          <Fact icon={Clock} label="แก้ไขล่าสุด">
            {dateOrDash(user.updatedAt)}
          </Fact>
          <Fact icon={KeyRound} label="รหัสผ่าน">
            {user.mustChangePassword ? 'ยังไม่ได้ตั้ง' : 'ตั้งแล้ว'}
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}

export { AccessCard as UserAccessCard, AccountInfoCard as UserAccountInfoCard };
