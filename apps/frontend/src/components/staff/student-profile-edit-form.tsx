'use client';

import { useState } from 'react';
import type { StaffOverviewProgram, StudentProfileDetail } from '@eduanalyze-ai/shared-types';
import { updateStudentProfile } from '@/lib/api/staff';
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/ui/form-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { buildProfileUpdate, REASON_MIN_LENGTH, reasonIsLongEnough } from './student-account';

// STAFF correcting a student's program, curriculum or admission year. The
// programs offered are the requester's own (from /dashboard/staff), and the
// server checks the scope again. The student code is shown, never editable.
export function StudentProfileEditForm({
  profile,
  programs,
  onSaved,
  onCancel,
}: Readonly<{
  profile: StudentProfileDetail;
  programs: StaffOverviewProgram[];
  onSaved: () => void;
  onCancel: () => void;
}>) {
  const [programId, setProgramId] = useState(profile.programId);
  const [curriculumId, setCurriculumId] = useState(profile.curriculumId);
  const [admissionYear, setAdmissionYear] = useState(String(profile.admissionYear));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const curricula = programs.find((p) => p.programId === programId)?.curricula ?? [];
  const year = Number(admissionYear);
  const yearValid = Number.isInteger(year) && admissionYear.trim() !== '';
  const dto = yearValid
    ? buildProfileUpdate(profile, { programId, curriculumId, admissionYear: year, reason })
    : null;
  const canSave = !saving && dto !== null && curriculumId !== '' && reasonIsLongEnough(reason);

  function handleProgramChange(next: string) {
    setProgramId(next);
    const nextCurricula = programs.find((p) => p.programId === next)?.curricula ?? [];
    setCurriculumId(
      next === profile.programId ? profile.curriculumId : (nextCurricula[0]?.curriculumId ?? ''),
    );
  }

  // Flow that writes: PATCH /student-profiles/:id (audited with the reason).
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!dto || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await updateStudentProfile(profile.id, dto);
      onSaved();
    } catch (err) {
      setError(
        describeApiError(err, {
          403: 'สาขาที่เลือกอยู่นอกขอบเขตที่คุณดูแล',
          404: 'ไม่พบนิสิตคนนี้แล้ว',
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>แก้ไขข้อมูลนิสิต</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <ApiErrorAlert message={error} onDismiss={() => setError(null)} />}

          <p className="text-sm text-muted-foreground">
            รหัสนิสิต{' '}
            <span className="font-semibold tabular-nums text-primary">{profile.studentCode}</span>{' '}
            แก้ไขไม่ได้ ·
            การเปลี่ยนหลักสูตรทำได้เมื่อนิสิตยังไม่มีผลการเรียนในวิชาที่ไม่อยู่ในหลักสูตรใหม่
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-program">สาขา</Label>
              <Select value={programId} onValueChange={handleProgramChange}>
                <SelectTrigger id="edit-program">
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.programId} value={p.programId} className="min-h-11">
                      {p.programCode} {p.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-curriculum">ฉบับหลักสูตร</Label>
              <Select value={curriculumId} onValueChange={setCurriculumId}>
                <SelectTrigger id="edit-curriculum">
                  <SelectValue placeholder="เลือกหลักสูตร" />
                </SelectTrigger>
                <SelectContent>
                  {curricula.map((c) => (
                    <SelectItem key={c.curriculumId} value={c.curriculumId} className="min-h-11">
                      ฉบับ {c.version} (พ.ศ. {c.effectiveYear})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-admission-year">ปีเข้าศึกษา</Label>
              <Input
                id="edit-admission-year"
                inputMode="numeric"
                value={admissionYear}
                onChange={(e) => setAdmissionYear(e.target.value)}
                aria-invalid={!yearValid}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">เหตุผลในการแก้ไข</Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="text-base md:text-sm"
              placeholder="เช่น แก้ปีเข้าที่กรอกผิดตอนเชิญ"
            />
            <p className="text-xs text-muted-foreground">
              อย่างน้อย {REASON_MIN_LENGTH} ตัวอักษร บันทึกไว้ในประวัติการเปลี่ยนแปลงของนิสิต
            </p>
          </div>

          <FormActions>
            <Button type="submit" className="px-5" disabled={!canSave}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="px-5"
              onClick={onCancel}
              disabled={saving}
            >
              ยกเลิกการแก้ไข
            </Button>
          </FormActions>
        </CardContent>
      </form>
    </Card>
  );
}
