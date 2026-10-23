'use client';

import { useEffect, useState } from 'react';
import type { InstructorListItem, StudentAdvisor } from '@eduanalyze-ai/shared-types';
import { updateStudentAdvisor } from '@/lib/api/staff';
import { describeApiError } from '@/lib/describe-api-error';
import { useToast } from '@/lib/toast-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/ui/form-actions';
import { StaffCombobox } from './staff-combobox';
import { StaffSheet } from './staff-sheet';

const OUT_OF_SCOPE_ERRORS: Partial<Record<number, string>> = {
  403: 'นิสิตคนนี้อยู่นอกขอบเขตที่คุณดูแล',
};

// Set, change or clear a student's academic advisor (PATCH
// /student-profiles/:id/advisor). Saved at once and kept in the history; the
// server answers in Thai for a non-instructor or a suspended student.
export function StudentAdvisorSheet({
  open,
  studentProfileId,
  studentName,
  current,
  instructors,
  onClose,
  onChanged,
}: Readonly<{
  open: boolean;
  studentProfileId: string;
  studentName: string;
  current: StudentAdvisor | null;
  instructors: InstructorListItem[];
  onClose: () => void;
  onChanged: () => void;
}>) {
  const toast = useToast();
  const [userId, setUserId] = useState<string | undefined>(current?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUserId(current?.id);
    setError(null);
  }, [open, current?.id]);

  const options = instructors.map((i) => ({
    value: i.id,
    label: `${i.fullName} (${i.email})`,
    searchText: `${i.fullName} ${i.email}`,
  }));
  const unchanged = (userId ?? null) === (current?.id ?? null);

  async function save(advisorUserId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await updateStudentAdvisor(studentProfileId, { advisorUserId });
      toast.success(advisorUserId ? 'บันทึกอาจารย์ที่ปรึกษาแล้ว' : 'เอาอาจารย์ที่ปรึกษาออกแล้ว');
      onChanged();
      onClose();
    } catch (e) {
      setError(describeApiError(e, OUT_OF_SCOPE_ERRORS));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={current ? 'เปลี่ยนอาจารย์ที่ปรึกษา' : 'กำหนดอาจารย์ที่ปรึกษา'}
      description={studentName}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">อาจารย์ที่ปรึกษา</p>
        <StaffCombobox
          options={options}
          value={userId}
          onValueChange={setUserId}
          placeholder="เลือกอาจารย์"
          searchPlaceholder="ค้นหาชื่อหรืออีเมล..."
          emptyText="ไม่พบอาจารย์"
          aria-label="เลือกอาจารย์ที่ปรึกษา"
        />
        <p id="advisor-hint" className="text-sm text-muted-foreground">
          อาจารย์ที่ปรึกษาจะเห็นผลการเรียนของนิสิตคนนี้ได้ (ดูอย่างเดียว)
          การเปลี่ยนจะบันทึกไว้ในประวัติ
        </p>
      </div>
      <FormActions className="pt-0">
        <Button
          type="button"
          className="px-5"
          disabled={busy || !userId || unchanged}
          aria-describedby="advisor-hint"
          onClick={() => userId && save(userId)}
        >
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        {current && (
          <Button
            type="button"
            variant="outline"
            className="px-5"
            disabled={busy}
            onClick={() => save(null)}
          >
            เอาอาจารย์ที่ปรึกษาออก
          </Button>
        )}
        <Button type="button" variant="outline" className="px-5" onClick={onClose}>
          ยกเลิก
        </Button>
      </FormActions>
    </StaffSheet>
  );
}
