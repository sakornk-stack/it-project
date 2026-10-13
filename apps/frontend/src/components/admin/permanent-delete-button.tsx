'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { describeApiError } from '@/lib/describe-api-error';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';

// "ลบถาวร" for one deactivated record. Irreversible, so the user must type the
// item's name before the confirm button turns on. `blockedReason` (from the
// references the API sends with the list) turns the button off and says why;
// the API's own 409 stays the authority and is shown if it still refuses.
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
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');

  function openDialog() {
    setTyped('');
    setConfirming(true);
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } catch (error) {
      onError(describeApiError(error));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label={`ลบถาวร${itemLabel}`}
        disabled={blockedReason !== null}
        onClick={openDialog}
      >
        <Trash2 size={16} aria-hidden="true" />
        ลบถาวร
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`ลบถาวร${itemLabel}?`}
        description={
          <div className="space-y-3">
            <p>ลบแล้วกู้คืนไม่ได้ และจะไม่ปรากฏในรายการที่ปิดใช้งานอีก</p>
            <label className="block space-y-1.5">
              <span className="block">
                พิมพ์ <strong className="text-foreground">{itemLabel}</strong> เพื่อยืนยัน
              </span>
              <Input
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
          </div>
        }
        confirmLabel="ลบถาวร"
        busy={busy}
        confirmDisabled={typed.trim() !== itemLabel}
        onConfirm={handleConfirm}
      />
    </>
  );
}
