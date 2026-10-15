'use client';

import { useId, useState } from 'react';
import { ChevronDown, KeyRound, ShieldCheck, Timer } from 'lucide-react';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { TwoFactorSection } from '@/components/auth/two-factor-section';
import { DetailSectionHeader } from '@/components/admin/detail-section-header';
import { SecurityCard, SecurityNote } from '@/components/profile/security-row';
import { Button } from '@/components/ui/button';
import { SESSION_TIMEOUT_CONFIG } from '@/lib/session-timeout-config';
import { cn } from '@/lib/utils';

const MINUTE_MS = 60_000;

// The account-protection section: a heading, then the password and 2FA cards side by side from
// lg up (each opens its own flow in place), then the idle-logout note across the full width.
export function AccountSecurityCard() {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const panelId = useId();
  // From the same config the idle guard runs on, so the line never drifts from what happens.
  const idleMinutes = SESSION_TIMEOUT_CONFIG.idleMs / MINUTE_MS;
  const showIdle = Number.isFinite(idleMinutes) && idleMinutes > 0;

  return (
    <section className="space-y-4">
      <DetailSectionHeader
        className="p-0 sm:p-0"
        icon={ShieldCheck}
        title="ความปลอดภัยของบัญชี"
        description="จัดการรหัสผ่านและการยืนยันตัวตนตอนเข้าสู่ระบบ"
      />
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <SecurityCard
          icon={KeyRound}
          className={passwordOpen ? 'lg:col-span-2' : undefined}
          title="รหัสผ่าน"
          description="ยืนยันรหัสผ่านปัจจุบันก่อนตั้งรหัสผ่านใหม่"
          action={
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5 transition-transform motion-safe:active:scale-[0.98] sm:w-auto"
              aria-expanded={passwordOpen}
              aria-controls={panelId}
              onClick={() => setPasswordOpen((v) => !v)}
            >
              เปลี่ยนรหัสผ่าน
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn(
                  'transition-transform duration-200 motion-reduce:transition-none',
                  passwordOpen && 'rotate-180',
                )}
              />
            </Button>
          }
        >
          {passwordOpen && (
            <div id={panelId}>
              <ChangePasswordForm variant="inline" onSuccess={() => setPasswordOpen(false)} />
            </div>
          )}
        </SecurityCard>
        <TwoFactorSection embedded />
        {showIdle && (
          <SecurityNote
            className="lg:col-span-2"
            icon={Timer}
            title={`ออกจากระบบอัตโนมัติเมื่อไม่ใช้งาน ${+idleMinutes.toFixed(1)} นาที`}
            description="ระบบจะแจ้งเตือนก่อนออกจากระบบ เพื่อความปลอดภัยเมื่อลืมออกจากระบบ"
          />
        )}
      </div>
    </section>
  );
}
