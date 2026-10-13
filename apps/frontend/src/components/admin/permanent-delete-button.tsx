'use client';

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { describeApiError } from '@/lib/describe-api-error';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';

// The typed-confirmation dialog of a permanent delete, controlled by the caller
// so it can be opened from a button or from a row menu. Irreversible, so the
// confirm button stays off until `confirmText` is typed exactly. `blockedReason`
// replaces the confirmation with the reason the delete cannot go ahead;
// `keepOpenOnError` shows a refusal from the API inside the dialog instead of
// closing it.
export function PermanentDeleteDialog({
  open,
  onOpenChange,
  title,
  confirmText,
  description,
  blockedReason = null,
  keepOpenOnError = false,
  onConfirm,
  onError,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // What the user must type; also named in the prompt.
  confirmText: string;
  description?: ReactNode;
  blockedReason?: string | null;
  keepOpenOnError?: boolean;
  onConfirm: () => Promise<void>;
  onError?: (message: string) => void;
}>) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      setTyped('');
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (caught) {
      const message = describeApiError(caught);
      if (keepOpenOnError) {
        setError(message);
      } else {
        onError?.(message);
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={
        <div className="space-y-3">
          {description ?? <p>ลบแล้วกู้คืนไม่ได้ และจะไม่ปรากฏในรายการที่ปิดใช้งานอีก</p>}
          {blockedReason ? (
            <p role="alert" className="font-medium text-destructive">
              {blockedReason}
            </p>
          ) : (
            <label className="block space-y-1.5">
              <span className="block">
                พิมพ์ <strong className="break-all text-foreground">{confirmText}</strong>{' '}
                เพื่อยืนยัน
              </span>
              <Input
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      }
      confirmLabel="ลบถาวร"
      busy={busy}
      confirmDisabled={blockedReason !== null || typed.trim() !== confirmText}
      onConfirm={() => void handleConfirm()}
    />
  );
}

// "ลบถาวร" for one deactivated record. `blockedReason` (from the references the
// API sends with the list) turns the button off and says why; the API's own 409
// stays the authority and is shown if it still refuses.
export function PermanentDeleteButton({
  itemLabel,
  blockedReason,
  onConfirm,
  onError,
}: Readonly<{
  itemLabel: string;
  blockedReason: string | null;
  onConfirm: () => Promise<void>;
  onError: (message: string) => void;
}>) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label={`ลบถาวร${itemLabel}`}
        disabled={blockedReason !== null}
        onClick={() => setConfirming(true)}
      >
        <Trash2 size={16} aria-hidden="true" />
        ลบถาวร
      </Button>
      <PermanentDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`ลบถาวร${itemLabel}?`}
        confirmText={itemLabel}
        onConfirm={onConfirm}
        onError={onError}
      />
    </>
  );
}
