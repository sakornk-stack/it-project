'use client';

import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import {
  ALL,
  PEOPLE_SORT_LABELS,
  type GradeFilter,
  type PeopleSort,
  type PersonCounts,
} from '@/lib/student-directory';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LowGradeFilterChips } from './low-grade-filter-chips';

// 44px at every width: tablets are touch screens too. Same height as the
// design system's default Button.
const CONTROL_HEIGHT = 'h-11';

export function StudentFilterBar({
  counts,
  grade,
  onGradeChange,
  courses,
  courseId,
  onCourseChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  isFiltered,
  onClear,
  actions,
}: Readonly<{
  counts: PersonCounts;
  grade: GradeFilter;
  onGradeChange: (grade: GradeFilter) => void;
  courses: { courseId: string; code: string; name: string }[];
  courseId: string;
  onCourseChange: (courseId: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  sort: PeopleSort;
  onSortChange: (sort: PeopleSort) => void;
  isFiltered: boolean;
  onClear: () => void;
  // Page-specific buttons (edit, export) at the right end of the row.
  actions?: ReactNode;
}>) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', !actions && 'xl:flex-nowrap')}>
      <LowGradeFilterChips counts={counts} value={grade} onChange={onGradeChange} />
      {courses.length > 1 && (
        <Select value={courseId} onValueChange={onCourseChange}>
          <SelectTrigger
            className={cn(CONTROL_HEIGHT, 'w-full sm:w-72 xl:shrink-0')}
            aria-label="กรองตามวิชา"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกวิชา</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.courseId} value={c.courseId}>
                {c.code} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={sort} onValueChange={(v) => onSortChange(v as PeopleSort)}>
        <SelectTrigger
          className={cn(CONTROL_HEIGHT, 'w-full sm:w-48 xl:shrink-0')}
          aria-label="เรียงลำดับ"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PEOPLE_SORT_LABELS) as PeopleSort[]).map((key) => (
            <SelectItem key={key} value={key}>
              เรียงตาม {PEOPLE_SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative w-full min-w-0 sm:min-w-64 sm:flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="ค้นหารหัสหรือชื่อนิสิต"
          aria-label="ค้นหารหัสหรือชื่อนิสิต"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(CONTROL_HEIGHT, 'w-full pl-9', search !== '' && 'pr-11')}
        />
        {search !== '' && (
          <button
            type="button"
            aria-label="ล้างคำค้นหา"
            onClick={() => onSearchChange('')}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
      {isFiltered && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className={cn(CONTROL_HEIGHT, 'shrink-0')}
        >
          ล้างตัวกรอง
        </Button>
      )}
      {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">{actions}</div>}
    </div>
  );
}
