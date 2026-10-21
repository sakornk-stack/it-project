'use client';

import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { shouldAnnounceRemaining } from '@/lib/session-timeout-machine';

interface SessionTimeoutDialogProps {
  remainingSeconds: number;
  totalSeconds: number;
  // False when the countdown is the absolute session cap: nothing to extend.
  canExtend: boolean;
  extending: boolean;
  onExtend: () => void;
  onLogout: () => void;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// Warning shown shortly before the idle timeout (or the absolute session
// cap) signs the user out. Built on the Radix Dialog primitive like
// ConfirmDialog, but deliberately NOT dismissable: Esc, outside clicks and a
// close button would all be a way to "ignore" the warning, so the only exits
// are the two buttons. Rendered only while the warning is up.
export function SessionTimeoutDialog({
  remainingSeconds,
  totalSeconds,
  canExtend,
  extending,
  onExtend,
  onLogout,
}: Readonly<SessionTimeoutDialogProps>) {
  const reducedMotion = usePrefersReducedMotion();
  const extendRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);

  // The visible countdown ticks every second; the screen-reader one does not
  // (first value, every 10 s, then each of the last 5 s).
  const announcedFirst = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (shouldAnnounceRemaining(remainingSeconds, !announcedFirst.current)) {
      announcedFirst.current = true;
      setAnnouncement(`เหลือเวลา ${remainingSeconds} วินาที`);
    }
  }, [remainingSeconds]);

  const percent = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;

  return (
    <DialogPrimitive.Root open onOpenChange={() => undefined}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60" />
        <DialogPrimitive.Content
          role="alertdialog"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            // Radix would focus the first tabbable element; the safe default
            // is the action that keeps the user signed in.
            event.preventDefault();
            (canExtend ? extendRef : logoutRef).current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-xl outline-none"
        >
          <div className="flex flex-col items-center gap-4">
            {reducedMotion ? (
              <div aria-hidden="true" className="flex flex-col items-center">
                <span className="text-5xl font-semibold tabular-nums text-primary">
                  {remainingSeconds}
                </span>
                <span className="text-sm text-muted-foreground">วินาที</span>
              </div>
            ) : (
              <div aria-hidden="true">
                <ProgressRing value={percent} label="เวลาที่เหลือ" size={104} strokeWidth={8}>
                  <span className="flex flex-col items-center leading-tight">
                    <span className="text-3xl font-semibold tabular-nums">{remainingSeconds}</span>
                    <span className="text-xs font-normal text-muted-foreground">วินาที</span>
                  </span>
                </ProgressRing>
              </div>
            )}

            <div className="space-y-2">
              <DialogPrimitive.Title className="flex items-center justify-center gap-2 text-lg font-semibold">
                <Clock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                กำลังจะสิ้นสุดเวลาการใช้งาน
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {canExtend
                  ? `เพื่อความปลอดภัยของข้อมูล ระบบจะออกจากระบบอัตโนมัติใน ${remainingSeconds} วินาที หากต้องการใช้งานต่อ กรุณากดต่อเวลา`
                  : `เซสชันนี้ใกล้ครบอายุสูงสุดที่ระบบกำหนด ระบบจะออกจากระบบอัตโนมัติใน ${remainingSeconds} วินาที ไม่สามารถต่อเวลาได้ กรุณาบันทึกงานของคุณและเข้าสู่ระบบอีกครั้ง`}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center [&>button]:w-full sm:[&>button]:w-auto">
            {canExtend && (
              <Button ref={extendRef} type="button" onClick={onExtend} disabled={extending}>
                {extending ? 'กำลังต่อเวลา…' : 'ต่อเวลา'}
              </Button>
            )}
            <Button
              ref={logoutRef}
              type="button"
              variant="outline"
              onClick={onLogout}
              disabled={extending}
            >
              ออกจากระบบ
            </Button>
          </div>

          {/* Polite, sparse countdown for screen readers; the numbers above are aria-hidden. */}
          <p aria-live="polite" role="status" className="sr-only">
            {announcement}
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
