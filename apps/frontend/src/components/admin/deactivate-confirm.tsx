'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// One confirmation for every "deactivate" in the Super Admin pages. All of
// them are soft deletes with no way back from the screen, so the dialog names
// the item and says so plainly. The API's 409 (still in use) stays the
// authority; the second line only warns the user it can happen.
export function DeactivateConfirm({
  open,
  onOpenChange,
  itemLabel,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`ปิดใช้งาน${itemLabel}?`}
      description={
        <div className="space-y-2">
          <p>
            ปิดแล้วจะไม่แสดงในระบบ เปิดใช้งานคืนได้ภายหลังจาก &quot;แสดงที่ปิดใช้งาน&quot;
          </p>
          <p>หากยังมีข้อมูลที่ใช้งานอยู่ ระบบจะไม่อนุญาต</p>
        </div>
      }
      confirmLabel="ปิดใช้งาน"
      busy={busy}
      onConfirm={onConfirm}
    />
  );
}
