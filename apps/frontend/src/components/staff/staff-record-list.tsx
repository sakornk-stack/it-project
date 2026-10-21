'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CourseListItem, StudentCourseRecord } from '@eduanalyze-ai/shared-types';
import { deleteCourseRecord, updateCourseRecordGrade } from '@/lib/api/academic-record';
import { usePagination } from '@/lib/use-pagination';
import { useToast } from '@/lib/toast-context';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { GradeBadge } from './grade-badge';
import { recordModeView } from './record-edit-mode';
import { StaffGradeSelect } from './staff-grade-select';
import { Pagination } from '@/components/ui/pagination';

export interface SemesterInfo {
  label: string;
  // Position in the newest-first list of semesters.
  order: number;
}

// The staff-side view of what students see as a timeline, minus the
// self-assessment link that belongs to the student. Newest semester first.
export function StaffRecordList({
  records,
  courseMap,
  semesterMap,
  editing,
  onChanged,
}: Readonly<{
  records: StudentCourseRecord[];
  courseMap: Map<string, CourseListItem>;
  semesterMap: Map<string, SemesterInfo>;
  editing: boolean;
  onChanged: () => void;
}>) {
  const mode = recordModeView(editing);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const toast = useToast();

  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          (semesterMap.get(a.semesterId)?.order ?? 999) -
            (semesterMap.get(b.semesterId)?.order ?? 999) ||
          (courseMap.get(a.courseId)?.code ?? '').localeCompare(
            courseMap.get(b.courseId)?.code ?? '',
          ),
      ),
    [records, semesterMap, courseMap],
  );
  const pagination = usePagination(sorted, pageSize, `${records.length}|${pageSize}`);

  // A row left awaiting delete-confirmation must not stay armed on another page.
  useEffect(() => {
    setConfirmingId(null);
  }, [pagination.page, editing]);

  // Flow that writes: PATCH /student-course-records/:id
  async function handleGradeChange(id: string, grade: StudentCourseRecord['grade']) {
    setBusyId(id);
    try {
      await updateCourseRecordGrade(id, { grade });
      onChanged();
      toast.success('บันทึกเกรดแล้ว');
    } catch {
      toast.error('บันทึกเกรดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusyId(null);
    }
  }

  // Flow that writes: DELETE /student-course-records/:id
  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteCourseRecord(id);
      setConfirmingId(null);
      onChanged();
      toast.success('ลบรายวิชาแล้ว');
    } catch {
      toast.error('ลบรายวิชาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusyId(null);
    }
  }

  if (records.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        description={
          editing
            ? 'ยังไม่มีรายวิชาที่บันทึกไว้ เพิ่มรายวิชาและเกรดได้จากแบบฟอร์มเพิ่มรายวิชา'
            : 'ยังไม่มีรายวิชาที่บันทึกไว้ กด “แก้ไขผลการเรียน” เพื่อเพิ่มรายวิชา'
        }
      />
    );
  }

  const gradeControl = (record: StudentCourseRecord) =>
    mode.gradeAs === 'text' ? (
      <GradeBadge grade={record.grade} />
    ) : (
      <StaffGradeSelect
        value={record.grade}
        subject={courseMap.get(record.courseId)?.code ?? 'วิชานี้'}
        disabled={busyId === record.id}
        onConfirm={(grade) => handleGradeChange(record.id, grade)}
      />
    );

  const deleteControl = (record: StudentCourseRecord) => {
    const code = courseMap.get(record.courseId)?.code ?? '';
    const isBusy = busyId === record.id;
    if (confirmingId === record.id) {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            className="px-3"
            disabled={isBusy}
            aria-label={`ยืนยันลบผลการเรียน ${code}`}
            onClick={() => handleDelete(record.id)}
          >
            ยืนยันลบ
          </Button>
          <Button
            type="button"
            variant="outline"
            className="px-3"
            disabled={isBusy}
            onClick={() => setConfirmingId(null)}
          >
            ยกเลิก
          </Button>
        </div>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        className="px-3"
        aria-label={`ลบผลการเรียน ${code}`}
        onClick={() => setConfirmingId(record.id)}
      >
        ลบ
      </Button>
    );
  };

  return (
    <div>
      <div className="hidden md:block">
        <DataTable>
          <thead>
            <tr>
              <th>รหัสวิชา</th>
              <th>ชื่อวิชา</th>
              <th className="data-num">หน่วยกิต</th>
              <th>ภาคเรียน</th>
              <th>เกรด</th>
              {mode.showDelete && <th>การจัดการ</th>}
            </tr>
          </thead>
          <tbody>
            {pagination.pageRows.map((record) => (
              <tr key={record.id} className="border-b border-slate-100 align-middle">
                <td className="font-semibold tabular-nums">
                  {courseMap.get(record.courseId)?.code ?? '—'}
                </td>
                <td className="break-words">
                  {courseMap.get(record.courseId)?.name ?? '—'}
                </td>
                <td className="data-num">{record.credits}</td>
                <td>{semesterMap.get(record.semesterId)?.label ?? '—'}</td>
                <td>{gradeControl(record)}</td>
                {mode.showDelete && <td>{deleteControl(record)}</td>}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <ul className="space-y-3 md:hidden">
        {pagination.pageRows.map((record) => (
          <li key={record.id} className="space-y-3 rounded-lg border border-slate-200 bg-card p-4">
            <div>
              <p className="font-semibold tabular-nums">
                {courseMap.get(record.courseId)?.code ?? '—'}
              </p>
              <p className="break-words">{courseMap.get(record.courseId)?.name ?? '—'}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">ภาคเรียน</dt>
                <dd>{semesterMap.get(record.semesterId)?.label ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">หน่วยกิต</dt>
                <dd className="tabular-nums">{record.credits}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">เกรด</p>
              {gradeControl(record)}
            </div>
            {mode.showDelete && <div>{deleteControl(record)}</div>}
          </li>
        ))}
      </ul>

      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        unit="รายการ"
        pageSize={pageSize}
        onPageChange={pagination.setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
