import Link from 'next/link';
import { ChevronRight, SearchX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import type { StaffStudentRow } from './staff-status';
import { NO_DATA_LABEL } from './student-reading';

// Stretched over the whole row (the row is `relative`), so the row is one real
// link; the focus ring is drawn on the row because the link itself has no box.
const ROW_LINK =
  'font-semibold text-primary outline-none after:absolute after:inset-0 after:content-[""]';

// Every student opens, suspended ones too: their page is read-only and is
// where STAFF reactivates the account.
function Action() {
  return (
    <span className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors [@media(hover:hover)]:group-hover:text-primary group-has-[:focus-visible]:text-primary">
      ดูรายละเอียด
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5 group-has-[:focus-visible]:translate-x-0.5 motion-reduce:transition-none"
      />
    </span>
  );
}

// The student's name, as the row's link.
function NameCell({ row }: { row: StaffStudentRow }) {
  return (
    <Link href={`/staff/students/${row.studentProfileId}`} className={cn(ROW_LINK, 'break-words')}>
      {row.fullName}
      <span className="sr-only"> ดูรายละเอียด</span>
    </Link>
  );
}

// One GPA figure per person and nothing about how many grades are behind it.
function gpaText(row: StaffStudentRow): string {
  if (!row.isActive) return '—';
  return row.gpa === null ? NO_DATA_LABEL : row.gpa.toFixed(2);
}

const yearText = (row: StaffStudentRow) => (row.yearLevel === null ? '—' : `ปี ${row.yearLevel}`);

export function StaffStudentList({
  rows,
  programName,
}: Readonly<{
  rows: StaffStudentRow[];
  programName: (programId: string) => string;
}>) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={SearchX}
            title="ไม่พบนิสิต"
            description="ไม่มีนิสิตที่ตรงกับเงื่อนไขที่เลือก ลองเปลี่ยนหรือล้างตัวกรองและคำค้นหาด้านบน"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <DataTable>
        <thead>
          <tr>
            <th>รหัสนิสิต</th>
            <th>ชื่อ-นามสกุล</th>
            <th>ชั้นปี</th>
            <th className="data-num">GPA สะสม</th>
            <th>สถานะทางวิชาการ</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.studentProfileId}
              className={cn(
                'interactive-row group relative border-b border-slate-100 align-middle',
                !row.isActive && 'text-muted-foreground',
              )}
            >
              <td className="font-semibold tabular-nums">{row.studentCode}</td>
              <td>
                <p>
                  <NameCell row={row} />
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  {programName(row.programId)}
                </p>
              </td>
              <td className="tabular-nums">{yearText(row)}</td>
              <td className="data-num">{gpaText(row)}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>
                <Action />
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.studentProfileId}
            className={cn(
              'interactive-card group relative space-y-3 rounded-lg border border-slate-200 bg-card p-4',
              !row.isActive && 'text-muted-foreground',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold tabular-nums">{row.studentCode}</p>
              <StatusBadge status={row.status} />
            </div>
            <div>
              <p>
                <NameCell row={row} />
              </p>
              <p className="break-words text-xs text-muted-foreground">
                {programName(row.programId)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">ชั้นปี</dt>
                <dd className="tabular-nums">{yearText(row)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">GPA สะสม</dt>
                <dd className="tabular-nums">{gpaText(row)}</dd>
              </div>
            </dl>
            <div className="flex">
              <Action />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
