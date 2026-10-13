'use client';

import { useRef, useState } from 'react';
import type { StaffOverviewReport } from '@eduanalyze-ai/shared-types';
import {
  executeInvitationImport,
  InvitationCsvFormatError,
  parseStudentInvitationCsv,
  STUDENT_INVITATION_CSV_HEADERS,
  type InvitationImportResultRow,
  type ParsedInvitationRow,
  type ReadyInvitationRow,
} from '@/lib/student-invitation-csv';
import { toCsv, downloadCsv } from '@/lib/csv';
import { useToast } from '@/lib/toast-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Inline, not a modal — same reasoning as ScoreCsvImportPanel: no Dialog
// primitive in this project, and this mirrors that panel's exact shape
// (file picker -> preview table -> confirm -> result list, no auto-close).

function PreviewTable({ rows }: Readonly<{ rows: ParsedInvitationRow[] }>) {
  return (
    <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="border-b border-slate-100 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">แถว</th>
            <th className="px-3 py-2 font-medium">รหัสนิสิต</th>
            <th className="px-3 py-2 font-medium">อีเมล</th>
            <th className="px-3 py-2 font-medium">ชื่อ-นามสกุล</th>
            <th className="px-3 py-2 font-medium">สาขา / ฉบับ</th>
            <th className="px-3 py-2 font-medium">ผล</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowNumber} className="border-b border-slate-50">
              <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
              <td className="px-3 py-2 text-primary">{row.studentCode || '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.email || '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.fullName || '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {row.programCodeText || '—'} / {row.curriculumVersionText || '—'}
              </td>
              <td className="px-3 py-2">
                {row.verdict === 'ready' ? (
                  <Badge tone="success">พร้อมเชิญ</Badge>
                ) : (
                  <span className="text-xs text-destructive">{row.error}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const OUTCOME_LABEL: Record<InvitationImportResultRow['outcome'], string> = {
  invited: 'ส่งคำเชิญแล้ว',
  skipped: 'ข้าม',
  failed: 'ผิดพลาด',
};

function ResultList({ results }: Readonly<{ results: InvitationImportResultRow[] }>) {
  const invited = results.filter((r) => r.outcome === 'invited').length;
  const notInvited = results.filter((r) => r.outcome !== 'invited');

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3">
      <p className="text-sm text-primary">
        ส่งคำเชิญสำเร็จ {invited} รายการ
        {notInvited.length > 0 && ` · ไม่สำเร็จ ${notInvited.length} รายการ`}
      </p>
      {notInvited.length > 0 && (
        <ul className="space-y-1">
          {notInvited.map((r) => (
            <li key={r.rowNumber} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                แถว {r.rowNumber} · {r.studentCode} · {OUTCOME_LABEL[r.outcome]}
              </span>
              <span className="text-destructive">{r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StudentInvitationCsvPanel({
  overview,
  onInvited,
  onClose,
}: Readonly<{
  overview: StaffOverviewReport;
  onInvited: () => void;
  onClose: () => void;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedInvitationRow[] | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [results, setResults] = useState<InvitationImportResultRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const toast = useToast();

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setRows(null);
    setResults(null);
    setFormatError(null);

    try {
      setRows(parseStudentInvitationCsv(await file.text(), overview));
    } catch (error) {
      setFormatError(
        error instanceof InvitationCsvFormatError ? error.message : 'ไม่สามารถอ่านไฟล์นี้ได้',
      );
    }
  }

  async function onConfirm() {
    if (!rows) return;
    const ready = rows.filter((row): row is ReadyInvitationRow => row.verdict === 'ready');
    setImporting(true);
    try {
      const imported = await executeInvitationImport(ready);
      setResults(imported);
      onInvited();
      const notInvitedCount = imported.filter((r) => r.outcome !== 'invited').length;
      if (notInvitedCount === 0) {
        toast.success(`ส่งคำเชิญ ${imported.length} รายการสำเร็จ`);
      } else {
        toast.error(
          `ส่งคำเชิญสำเร็จ ${imported.length - notInvitedCount} รายการ ไม่สำเร็จ ${notInvitedCount} รายการ`,
        );
      }
    } catch {
      toast.error('ส่งคำเชิญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setImporting(false);
    }
  }

  function onDownloadTemplate() {
    downloadCsv('student-invitation-template.csv', toCsv(STUDENT_INVITATION_CSV_HEADERS, []));
  }

  const readyCount = rows?.filter((r) => r.verdict === 'ready').length ?? 0;
  const invalidCount = (rows?.length ?? 0) - readyCount;

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-primary">นำเข้าคำเชิญจากไฟล์ CSV</p>
        <Button type="button" variant="outline" className="px-4" onClick={onClose}>
          ปิด
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        คอลัมน์ที่ต้องมี: รหัสนิสิต, อีเมล, ชื่อ-นามสกุล, รหัสสาขา, ฉบับหลักสูตร, ปีเข้าศึกษา —
        ระบบจะส่งอีเมลเชิญให้แต่ละคน ผู้ถูกเชิญยังต้องสมัครสมาชิกด้วยตนเอง
        ไม่มีการสร้างบัญชีให้ทันที
      </p>

      {overview.programs.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="min-h-11 cursor-pointer py-3 text-brand hover:underline">
            ดูรหัสสาขาและฉบับหลักสูตรที่ใช้ได้
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {overview.programs.map((program) => (
              <li key={program.programId}>
                {program.programCode} — {program.programName} (ฉบับ:{' '}
                {program.curricula.map((c) => c.version).join(', ') || 'ไม่มี'})
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />
        <Button
          type="button"
          variant="outline"
          className="px-4"
          onClick={() => inputRef.current?.click()}
        >
          เลือกไฟล์ CSV
        </Button>
        <Button type="button" variant="outline" className="px-4" onClick={onDownloadTemplate}>
          ดาวน์โหลดเทมเพลต
        </Button>
        {fileName && (
          <span className="min-w-0 break-all text-xs text-muted-foreground">{fileName}</span>
        )}
      </div>

      {formatError && (
        <Alert variant="destructive">
          <AlertDescription>{formatError}</AlertDescription>
        </Alert>
      )}

      {rows && !results && (
        <div className="space-y-3">
          <p className="text-sm text-primary">
            ตรวจไฟล์แล้ว {rows.length} แถว · พร้อมเชิญ {readyCount}
            {invalidCount > 0 && ` · ผิดพลาด ${invalidCount}`}
          </p>
          <PreviewTable rows={rows} />
          {invalidCount > 0 && (
            <p className="text-xs text-muted-foreground">
              แถวที่ผิดพลาดจะไม่ถูกเชิญ แก้ไขไฟล์แล้วเลือกใหม่อีกครั้งเพื่อนำเข้าส่วนที่เหลือ
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="px-4"
              onClick={onConfirm}
              disabled={importing || readyCount === 0}
            >
              {importing ? 'กำลังส่งคำเชิญ...' : `ยืนยันส่งคำเชิญ ${readyCount} แถว`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="px-4"
              onClick={onClose}
              disabled={importing}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      )}

      {results && <ResultList results={results} />}
    </div>
  );
}
