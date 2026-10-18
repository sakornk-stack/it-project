'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Grade } from '@eduanalyze-ai/shared-types';
import { GRADE_LABELS, GRADE_OPTIONS } from '@/lib/grade-label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// A grade edit saves straight to the record, and the backend stamps the
// editor as the last writer — so a mis-click can't be cleanly undone.
// Picking a value here only stages it; nothing is sent until "บันทึก".
export function GradeSelectConfirm({
  value,
  subject,
  disabled,
  onConfirm,
  stacked = false,
  trailing,
  onPendingChange,
}: Readonly<{
  value: Grade;
  subject: string;
  disabled?: boolean;
  onConfirm: (grade: Grade) => void;
  // Roster card layout: the select takes the full row (with `trailing` at its right
  // end) and the "change X → Y?" question sits on a row of its own below it.
  stacked?: boolean;
  trailing?: ReactNode;
  // Tells the card around it that a change is waiting for confirmation.
  onPendingChange?: (pending: boolean) => void;
}>) {
  const [pending, setPending] = useState<Grade | null>(null);

  useEffect(() => {
    onPendingChange?.(pending !== null);
  }, [pending, onPendingChange]);

  // The record changed underneath (refetch after a save, edit elsewhere).
  useEffect(() => {
    setPending(null);
  }, [value]);

  const select = (
    <Select
      value={value}
      onValueChange={(next) => setPending(next === value ? null : (next as Grade))}
      disabled={disabled}
    >
      <SelectTrigger
        className={stacked ? 'w-full' : 'w-24 shrink-0'}
        aria-label={`เกรดของ ${subject}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GRADE_OPTIONS.map((g) => (
          <SelectItem key={g} value={g}>
            {GRADE_LABELS[g]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const confirmButtons = pending && (
    <>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        aria-label={`บันทึกเกรด ${GRADE_LABELS[pending]} ให้ ${subject}`}
        onClick={() => {
          const grade = pending;
          setPending(null);
          onConfirm(grade);
        }}
      >
        {stacked ? 'ยืนยัน' : 'บันทึก'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setPending(null)}
      >
        ยกเลิก
      </Button>
    </>
  );

  if (stacked) {
    return (
      <div className="w-full space-y-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{select}</div>
          {trailing}
        </div>
        {pending && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="status">
            <span className="min-w-0 flex-1 basis-40 break-words text-sm text-muted-foreground">
              เปลี่ยน {GRADE_LABELS[value]} → {GRADE_LABELS[pending]}?
            </span>
            <span className="flex gap-2">{confirmButtons}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {select}
      {pending && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            เปลี่ยน {GRADE_LABELS[value]} → {GRADE_LABELS[pending]}?
          </span>
          {confirmButtons}
        </div>
      )}
    </div>
  );
}
