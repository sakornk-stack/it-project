'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Confirmation prompt for destructive actions, on the same Radix Dialog
// primitive as Sheet and the graduation celebration. The red warning icon is
// only for a destructive confirm; anything else gets a neutral info icon. The
// confirm button comes first (left), cancel next to it, as in every form.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'ยกเลิก',
  confirmVariant = 'destructive',
  busy = false,
  confirmDisabled = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  // 'default' for a confirmation that is not destructive, such as restoring something.
  confirmVariant?: 'destructive' | 'default';
  busy?: boolean;
  // Keeps the confirm button off until the caller's own condition holds (e.g. a typed name).
  confirmDisabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-card-foreground shadow-xl outline-none sm:p-6 sm:pb-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                confirmVariant === 'destructive'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-brand-light text-brand',
              )}
            >
              {confirmVariant === 'destructive' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Info className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <DialogPrimitive.Title className="course-name-break text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description asChild>
                <div className="course-name-break text-sm text-muted-foreground">{description}</div>
              </DialogPrimitive.Description>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row [&>button]:w-full sm:[&>button]:w-auto">
            <Button
              type="button"
              variant={confirmVariant}
              disabled={busy || confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="outline" disabled={busy}>
                {cancelLabel}
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
