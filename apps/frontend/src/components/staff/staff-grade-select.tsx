'use client';

import { useEffect, useState } from 'react';
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

// Staff-sized copy of components/academic-record/grade-select-confirm.tsx
// (shared with the student timeline and the instructor roster, so left as it
// is). Same behaviour: picking a grade only stages it, nothing is sent until
// "บันทึก", because the backend stamps the editor as the last writer.
export function StaffGradeSelect({
  value,
  subject,
  disabled,
  onConfirm,
}: Readonly<{
  value: Grade;
  subject: string;
  disabled?: boolean;
  onConfirm: (grade: Grade) => void;
}>) {
  const [pending, setPending] = useState<Grade | null>(null);

  // The record changed underneath (refetch after a save, edit elsewhere).
  useEffect(() => {
    setPending(null);
  }, [value]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value}
        onValueChange={(next) => setPending(next === value ? null : (next as Grade))}
        disabled={disabled}
      >
        <SelectTrigger className="w-28 shrink-0" aria-label={`เกรดของ ${subject}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GRADE_OPTIONS.map((g) => (
            <SelectItem key={g} value={g} className="min-h-11">
              {GRADE_LABELS[g]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            เปลี่ยน {GRADE_LABELS[value]} → {GRADE_LABELS[pending]}?
          </span>
          <Button
            type="button"
            className="px-4"
            disabled={disabled}
            aria-label={`บันทึกเกรด ${GRADE_LABELS[pending]} ให้ ${subject}`}
            onClick={() => {
              const grade = pending;
              setPending(null);
              onConfirm(grade);
            }}
          >
            บันทึก
          </Button>
          <Button
            type="button"
            variant="outline"
            className="px-4"
            disabled={disabled}
            onClick={() => setPending(null)}
          >
            ยกเลิก
          </Button>
        </div>
      )}
    </div>
  );
}
