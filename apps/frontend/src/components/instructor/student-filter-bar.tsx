'use client';

import { ALL, type GradeFilter, type PersonCounts } from '@/lib/student-directory';
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
  isFiltered,
  onClear,
}: Readonly<{
  counts: PersonCounts;
  grade: GradeFilter;
  onGradeChange: (grade: GradeFilter) => void;
  courses: { courseId: string; code: string; name: string }[];
  courseId: string;
  onCourseChange: (courseId: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  isFiltered: boolean;
  onClear: () => void;
}>) {
  return (
    <div className="space-y-3">
      <LowGradeFilterChips counts={counts} value={grade} onChange={onGradeChange} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Select value={courseId} onValueChange={onCourseChange}>
          <SelectTrigger className={cn(CONTROL_HEIGHT, 'w-full')} aria-label="กรองตามวิชา">
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
        <Input
          type="search"
          placeholder="ค้นหารหัสหรือชื่อนิสิต"
          aria-label="ค้นหารหัสหรือชื่อนิสิต"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(CONTROL_HEIGHT, 'w-full')}
        />
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className={cn(CONTROL_HEIGHT, 'justify-self-start sm:col-span-2 lg:col-span-1')}
          >
            ล้างตัวกรอง
          </Button>
        )}
      </div>
    </div>
  );
}
