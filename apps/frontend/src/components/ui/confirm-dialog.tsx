'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Confirmation prompt for destructive actions, on the same Radix Dialog
// primitive as Sheet and the graduation celebration. The red warning icon is
// only for a destructive confirm; anything else gets a neutral info icon.
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
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 text-card-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <div className="flex items-start gap-3">
            {confirmVariant === 'destructive' ? (
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                aria-hidden="true"
              />
            ) : (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            )}
            <div className="space-y-2">
              <DialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description asChild>
                <div className="text-sm text-muted-foreground">{description}</div>
              </DialogPrimitive.Description>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" disabled={busy}>
                {cancelLabel}
              </Button>
            </DialogPrimitive.Close>
            <Button
              type="button"
              variant={confirmVariant}
              disabled={busy || confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
