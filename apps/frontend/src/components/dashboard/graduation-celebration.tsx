'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { GraduationCap } from 'lucide-react';
import { useSessionOnce } from '@/lib/use-session-once';
import { Button } from '@/components/ui/button';
import { ConfettiBurst } from '@/components/ui/confetti-burst';

// Congratulations modal + full-screen confetti, shown once per tab session
// when the student is graduation-ready. Reduced motion keeps the modal and
// drops only the confetti (the global CSS rule would still flash the pieces).
export function GraduationCelebration({
  studentProfileId,
  isReady,
}: Readonly<{ studentProfileId: string; isReady: boolean }>) {
  const { show, dismiss } = useSessionOnce(`celebrate:graduation:${studentProfileId}`, isReady);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!show) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setConfetti(true);
  }, [show]);

  return (
    <>
      <DialogPrimitive.Root open={show} onOpenChange={(open) => !open && dismiss()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 text-center text-card-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">
              <GraduationCap size={28} aria-hidden="true" />
            </div>
            <DialogPrimitive.Title className="mt-4 text-xl font-semibold text-primary">
              ยินดีด้วย! นิสิตพร้อมสำเร็จการศึกษา
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              นิสิตผ่านเกณฑ์หน่วยกิต หมวดวิชา และวิชาบังคับครบแล้ว
            </DialogPrimitive.Description>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href="/credit-checker">ดูผลตรวจหน่วยกิต</Link>
              </Button>
              <DialogPrimitive.Close asChild>
                <Button variant="outline">ปิด</Button>
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      {/* Portalled to <body>: a fixed layer inside the page would be offset by
          the content stack's space-y margins and any transformed ancestor. */}
      {confetti && createPortal(<ConfettiBurst variant="viewport" delayMs={250} />, document.body)}
    </>
  );
}
