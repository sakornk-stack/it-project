'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { TwoFactorSection } from '@/components/auth/two-factor-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// One card for both account-protection controls. The password form opens in place under its
// own row and folds back after a successful change; 2FA keeps its existing flow untouched.
export function AccountSecurityCard() {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const panelId = useId();

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-primary">ความปลอดภัยของบัญชี</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="space-y-4 pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-primary">รหัสผ่าน</h3>
              <p className="text-sm text-muted-foreground">
                ยืนยันรหัสผ่านปัจจุบันก่อนตั้งรหัสผ่านใหม่
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-1.5 self-start sm:self-auto"
              aria-expanded={passwordOpen}
              aria-controls={panelId}
              onClick={() => setPasswordOpen((v) => !v)}
            >
              เปลี่ยนรหัสผ่าน
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn(
                  'transition-transform motion-reduce:transition-none',
                  passwordOpen && 'rotate-180',
                )}
              />
            </Button>
          </div>
          <div id={panelId} hidden={!passwordOpen}>
            {passwordOpen && (
              <ChangePasswordForm variant="inline" onSuccess={() => setPasswordOpen(false)} />
            )}
          </div>
        </div>
        <div className="pt-6">
          <TwoFactorSection embedded />
        </div>
      </CardContent>
    </Card>
  );
}
