import Link from 'next/link';
import { ChevronRight, Lock, SearchX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import type { StaffStudentRow } from './staff-status';
import { NO_DATA_LABEL } from './student-reading';

const LOCKED_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded border border-dashed border-slate-300 px-3 text-sm text-muted-foreground';
// Stretched over the whole row (the row is `relative`), so the row is one real
// link; the focus ring is drawn on the row because the link itself has no box.
const ROW_LINK =
  'font-semibold text-primary outline-none after:absolute after:inset-0 after:content-[""]';
const ROW_FOCUS =
  'focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ring';

// A suspended student's detail page answers 404, so the action is a note
// instead of a link.
function Action({ row }: { row: StaffStudentRow }) {
  if (!row.isActive) {
    return (
      <span className={LOCKED_BUTTON}>
        <Lock aria-hidden="true" className="h-4 w-4" />
        เปิดดูไม่ได้
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-primary">
      ดูรายละเอียด
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </span>
  );
}

// The student's name, as the row's link when the student can be opened.
function NameCell({ row }: { row: StaffStudentRow }) {
  if (!row.isActive) return <span className="break-words font-semibold">{row.fullName}</span>;
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
            description="ไม่พบนิสิตที่ตรงกับเงื่อนไขที่เลือก ลองเปลี่ยนหรือล้างตัวกรองและคำค้นหาด้านบน"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200 bg-slate-50 text-xs text-muted-foreground">
            <th className="px-3 py-3 font-semibold">รหัสนิสิต</th>
            <th className="px-3 py-3 font-semibold">ชื่อ-นามสกุล</th>
            <th className="px-3 py-3 font-semibold">ชั้นปี</th>
            <th className="px-3 py-3 text-right font-semibold">GPA สะสม</th>
            <th className="px-3 py-3 font-semibold">สถานะทางวิชาการ</th>
            <th className="px-3 py-3 font-semibold">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.studentProfileId}
              className={cn(
                'group relative border-b border-slate-100 align-middle transition-colors motion-reduce:transition-none',
                row.isActive ? cn('hover:bg-slate-50', ROW_FOCUS) : 'text-muted-foreground',
              )}
            >
              <td className="px-3 py-3 font-semibold tabular-nums">{row.studentCode}</td>
              <td className="px-3 py-3">
                <p>
                  <NameCell row={row} />
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  {programName(row.programId)}
                </p>
              </td>
              <td className="px-3 py-3 tabular-nums">{yearText(row)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{gpaText(row)}</td>
              <td className="px-3 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-3">
                <Action row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.studentProfileId}
            className={cn(
              'group relative space-y-3 rounded-lg border border-slate-200 bg-card p-4 transition motion-reduce:transition-none',
              row.isActive
                ? cn('hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none', ROW_FOCUS)
                : 'text-muted-foreground',
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
              <Action row={row} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
