'use client';

import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import type { CourseListItem, InstructorListItem } from '@eduanalyze-ai/shared-types';
import { createCourseInstructor } from '@/lib/api/staff';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, STAFF_WRITE_ERRORS } from '@/lib/api-error-presets';
import { useToast } from '@/lib/toast-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/ui/form-actions';
import { StaffCombobox } from './staff-combobox';
import { StaffSheet } from './staff-sheet';

// Assign one more instructor to a course. A course can have several; the
// assignment belongs to the curriculum's course, not to a semester.
export function AssignInstructorSheet({
  course,
  assignedUserIds,
  instructors,
  onClose,
  onChanged,
}: Readonly<{
  course: CourseListItem | null;
  assignedUserIds: ReadonlySet<string>;
  instructors: InstructorListItem[];
  onClose: () => void;
  onChanged: () => void;
}>) {
  const toast = useToast();
  const [userId, setUserId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(undefined);
    setError(null);
  }, [course?.id]);

  const options = instructors
    .filter((i) => !assignedUserIds.has(i.id))
    .map((i) => ({
      value: i.id,
      label: `${i.fullName} (${i.email})`,
      searchText: `${i.fullName} ${i.email}`,
    }));

  // Flow that writes: POST /course-instructors
  async function assign() {
    if (!course || !userId) return;
    setBusy(true);
    setError(null);
    try {
      await createCourseInstructor({ courseId: course.id, userId });
      toast.success('มอบหมายอาจารย์แล้ว');
      onChanged();
      onClose();
    } catch (e) {
      setError(
        isAxiosError(e) && e.response?.status === 409
          ? 'อาจารย์ท่านนี้ได้รับมอบหมายให้วิชานี้แล้ว'
          : isAxiosError(e) && e.response?.status === 400
            ? 'มอบหมายไม่ได้ เพราะผู้ใช้นี้ไม่ได้มีบทบาทอาจารย์'
            : describeApiError(e, STAFF_WRITE_ERRORS, undefined, OWN_SENTENCE_ONLY),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffSheet
      open={course !== null}
      onOpenChange={(open) => !open && onClose()}
      title={course ? `มอบหมายอาจารย์ให้ ${course.code}` : 'มอบหมายอาจารย์'}
      description={course?.name}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">อาจารย์ผู้รับผิดชอบวิชา</p>
        <StaffCombobox
          options={options}
          value={userId}
          onValueChange={setUserId}
          placeholder="เลือกอาจารย์"
          searchPlaceholder="ค้นหาชื่อหรืออีเมล..."
          emptyText="ไม่พบอาจารย์ที่ยังไม่ได้รับมอบหมาย"
          aria-label="เลือกอาจารย์ผู้รับผิดชอบวิชา"
        />
        {!userId && (
          <p id="assign-hint" className="text-sm text-muted-foreground">
            เลือกอาจารย์ก่อน ปุ่ม “มอบหมาย” จึงจะกดได้
          </p>
        )}
      </div>
      <FormActions className="pt-0">
        <Button
          type="button"
          className="px-5"
          disabled={busy || !userId}
          aria-describedby={userId ? undefined : 'assign-hint'}
          onClick={assign}
        >
          {busy ? 'กำลังบันทึก...' : 'มอบหมาย'}
        </Button>
        <Button type="button" variant="outline" className="px-5" onClick={onClose}>
          ยกเลิก
        </Button>
      </FormActions>
    </StaffSheet>
  );
}
