'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import { accountStatus } from '@/lib/account-status';
import { BADGE_TONE_CLASSES, BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { primaryRoleFor, ROLE_BADGE_TONE, ROLE_LABEL_TH } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const COPIED_FEEDBACK_MS = 2000;

function StatusBadge({ user }: Readonly<{ user: AdminUserSummary }>) {
  const { tone, label, live } = accountStatus(user);
  return (
    <Badge tone={tone} className="gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className="relative flex h-2 w-2">
        {live && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none',
              BAR_TONE_CLASSES[tone],
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', BAR_TONE_CLASSES[tone])} />
      </span>
      {label}
    </Badge>
  );
}

function InfoCell({
  icon: Icon,
  label,
  action,
  children,
}: Readonly<{
  icon: typeof Mail;
  label: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/40 p-3 sm:gap-3 sm:p-4">
      <span
        aria-hidden="true"
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand min-[400px]:flex"
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium">{children}</dd>
      </div>
      {action}
    </div>
  );
}

// Copies the address and shows a check for a moment; a refusal (no clipboard
// access) says so in a toast instead of failing silently.
export function CopyEmailButton({
  email,
  tooltip = true,
}: Readonly<{ email: string; tooltip?: boolean }>) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast.error('คัดลอกอีเมลไม่สำเร็จ');
    }
  }

  const label = copied ? 'คัดลอกแล้ว' : 'คัดลอกอีเมล';
  const button = (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={() => void copy()}>
      {copied ? (
        <Check size={18} aria-hidden="true" className="text-emerald-600" />
      ) : (
        <Copy size={18} aria-hidden="true" />
      )}
    </Button>
  );
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span
        role="status"
        aria-live="polite"
        className={cn(
          'text-xs font-medium text-emerald-700 transition-opacity duration-150 motion-reduce:transition-none',
          copied ? 'opacity-100 max-sm:sr-only' : 'sr-only',
        )}
      >
        {copied ? 'คัดลอกแล้ว' : ''}
      </span>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </div>
  );
}

// Who this account is: initials avatar, name, status, roles, and the facts the
// API holds about it (email). Last sign-in is not in the API.
export const AVATAR_RING: Record<SemanticTone, string> = {
  success: 'from-emerald-300 to-emerald-100',
  warning: 'from-amber-300 to-amber-100',
  danger: 'from-red-300 to-red-100',
  neutral: 'from-slate-300 to-slate-100',
};

export function UserProfileCard({ user }: Readonly<{ user: AdminUserSummary }>) {
  // The avatar takes the colour of the account's highest role, from the shared role tones.
  const tone = user.roles.length > 0 ? ROLE_BADGE_TONE[primaryRoleFor(user.roles)] : 'neutral';
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-5">
          <span
            className={cn(
              'shrink-0 rounded-full bg-gradient-to-br p-[3px] shadow-sm',
              AVATAR_RING[tone],
            )}
          >
            <InitialsAvatar
              name={user.fullName}
              className={cn(
                'h-16 w-16 border-2 border-card text-3xl sm:h-24 sm:w-24 sm:text-4xl',
                BADGE_TONE_CLASSES[tone],
              )}
            />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <h1
              title={user.fullName}
              className="course-name-break text-xl font-semibold text-primary sm:text-2xl"
            >
              {user.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge user={user} />
              {user.roles.map((role) => (
                <Badge key={role} tone={ROLE_BADGE_TONE[role]}>
                  {ROLE_LABEL_TH[role]}
                </Badge>
              ))}
              {user.roles.length === 0 && (
                <span className="text-sm text-muted-foreground">ยังไม่มีบทบาท</span>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-5 border-t pt-5">
          <InfoCell icon={Mail} label="อีเมลสถาบัน" action={<CopyEmailButton email={user.email} />}>
            <span className="block break-all text-sm sm:text-base" title={user.email}>
              {user.email}
            </span>
          </InfoCell>
        </dl>
      </CardContent>
    </Card>
  );
}
