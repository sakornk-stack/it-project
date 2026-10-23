'use client';

import { useState } from 'react';
import type { AuditLogEntry } from '@eduanalyze-ai/shared-types';
import { formatThaiDateTime } from '@/lib/admin-users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { describeAuditEntry, isGradeAction, type AuditLabelLookups } from './describe-audit-entry';

// Read-only change history of one student: grades entered, changed or removed
// by staff or instructors (a student's own edits are not recorded), account
// suspensions and profile corrections. Newest first, as the API returns it.
export function StudentHistorySection({
  entries,
  loading,
  failed,
  onRetry,
  labels,
}: Readonly<{
  entries: AuditLogEntry[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  labels: AuditLabelLookups;
}>) {
  const [gradesOnly, setGradesOnly] = useState(false);
  const shown = (entries ?? []).filter((e) => !gradesOnly || isGradeAction(e.action));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>ประวัติการเปลี่ยนแปลง</CardTitle>
        <Button
          type="button"
          variant={gradesOnly ? 'default' : 'outline'}
          className="px-4"
          aria-pressed={gradesOnly}
          onClick={() => setGradesOnly((on) => !on)}
        >
          เฉพาะผลการเรียน
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          บันทึกการแก้ไขผลการเรียนโดยเจ้าหน้าที่และอาจารย์ การระงับ/เปิดบัญชี และการแก้ไขข้อมูลนิสิต
          ไม่รวมรายการที่นิสิตเพิ่มหรือแก้เอง (แต่การลบรายวิชาโดยนิสิตจะถูกบันทึกไว้)
        </p>
        {loading && <ListSkeleton />}
        {failed && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            โหลดประวัติไม่สำเร็จ
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={onRetry}
            >
              ลองอีกครั้ง
            </Button>
          </div>
        )}
        {!loading && !failed && shown.length === 0 && (
          <EmptyState
            illustration="no-data"
            description={
              gradesOnly ? 'ยังไม่มีประวัติการแก้ไขผลการเรียน' : 'ยังไม่มีประวัติการเปลี่ยนแปลง'
            }
          />
        )}
        {shown.length > 0 && (
          <ol className="divide-y">
            {shown.map((entry) => {
              const view = describeAuditEntry(entry, labels);
              return (
                <li key={entry.id} className="space-y-1 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold text-primary">{view.title}</span>
                    <time
                      dateTime={entry.createdAt}
                      className="text-xs tabular-nums text-muted-foreground"
                    >
                      {formatThaiDateTime(entry.createdAt)}
                    </time>
                  </div>
                  {view.detail && <p className="course-name-break">{view.detail}</p>}
                  {entry.reason && (
                    <p className="break-words text-muted-foreground">เหตุผล: {entry.reason}</p>
                  )}
                  <p className="text-xs text-muted-foreground">โดย {view.actor}</p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
