'use client';

import { useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import type { StudentProfileDetail } from '@eduanalyze-ai/shared-types';
import { updateStudentActiveStatus } from '@/lib/api/staff';
import { describeApiError } from '@/lib/describe-api-error';
import { useToast } from '@/lib/toast-context';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isStudentSuspended, REASON_MIN_LENGTH, reasonIsLongEnough } from './student-account';

type Step = 'closed' | 'reason' | 'confirm';

// STAFF suspending or reactivating a student account, confirmed twice: first
// the reason, then a summary that only unlocks once the student code is typed.
// Never deletes; reactivation is always possible from the same page.
export function StudentAccountStatusControl({
  profile,
  onChanged,
}: Readonly<{ profile: StudentProfileDetail; onChanged: () => void }>) {
  const toast = useToast();
  const suspended = isStudentSuspended(profile);
  const [step, setStep] = useState<Step>('closed');
  const [reason, setReason] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verb = suspended ? 'เปิดบัญชีอีกครั้ง' : 'ระงับบัญชี';
  const name = profile.user.fullName;

  function close() {
    setStep('closed');
    setReason('');
    setTypedCode('');
    setError(null);
  }

  // Flow that writes: PATCH /student-profiles/:id/active-status (audited).
  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await updateStudentActiveStatus(profile.id, { isActive: suspended, reason: reason.trim() });
      toast.success(suspended ? `เปิดบัญชีของ ${name} แล้ว` : `ระงับบัญชีของ ${name} แล้ว`);
      close();
      onChanged();
    } catch (err) {
      setError(
        describeApiError(err, {
          403: 'นิสิตคนนี้อยู่นอกขอบเขตที่คุณดูแล',
          404: 'ไม่พบนิสิตคนนี้แล้ว',
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={
          suspended ? 'gap-1.5 px-4' : 'gap-1.5 px-4 text-destructive hover:text-destructive'
        }
        onClick={() => setStep('reason')}
      >
        {suspended ? (
          <RotateCcw aria-hidden="true" size={16} />
        ) : (
          <Ban aria-hidden="true" size={16} />
        )}
        {verb}
      </Button>

      <ConfirmDialog
        open={step === 'reason'}
        onOpenChange={(open) => !open && close()}
        title={`${verb}ของ ${name}?`}
        description={
          <div className="space-y-3">
            <p>
              {suspended
                ? 'นิสิตจะเข้าสู่ระบบได้อีกครั้งและกลับมาแสดงในสถิติของสาขา'
                : 'นิสิตจะเข้าสู่ระบบไม่ได้ทันที และไม่ถูกนับในสถิติของสาขา ผลการเรียนยังอยู่ครบ เปิดบัญชีคืนได้ภายหลังจากหน้านี้'}
            </p>
            <div className="space-y-2 text-foreground">
              <Label htmlFor="status-reason">เหตุผล</Label>
              <Textarea
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                className="text-base md:text-sm"
                placeholder={suspended ? 'เช่น กลับเข้าศึกษาตามคำร้อง' : 'เช่น ลาออกตามคำร้อง'}
              />
              <p className="text-xs text-muted-foreground">
                อย่างน้อย {REASON_MIN_LENGTH} ตัวอักษร บันทึกไว้ในประวัติการเปลี่ยนแปลงของนิสิต
              </p>
            </div>
          </div>
        }
        confirmLabel="ถัดไป"
        cancelLabel="ไม่ดำเนินการ"
        confirmVariant="default"
        confirmDisabled={!reasonIsLongEnough(reason)}
        onConfirm={() => setStep('confirm')}
      />

      <ConfirmDialog
        open={step === 'confirm'}
        onOpenChange={(open) => !open && close()}
        title={`ยืนยัน${verb}`}
        description={
          <div className="space-y-3">
            {error && <ApiErrorAlert message={error} />}
            <p>
              <span className="font-semibold text-foreground">{name}</span> ·{' '}
              <span className="tabular-nums">{profile.studentCode}</span>
            </p>
            <p className="break-words">เหตุผล: {reason.trim()}</p>
            <div className="space-y-2 text-foreground">
              <Label htmlFor="status-confirm-code">พิมพ์รหัสนิสิตเพื่อยืนยัน</Label>
              <Input
                id="status-confirm-code"
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder={profile.studentCode}
              />
            </div>
          </div>
        }
        confirmLabel={verb}
        cancelLabel="ไม่ดำเนินการ"
        confirmVariant={suspended ? 'default' : 'destructive'}
        confirmDisabled={typedCode.trim() !== profile.studentCode}
        busy={busy}
        onConfirm={handleConfirm}
      />
    </>
  );
}
