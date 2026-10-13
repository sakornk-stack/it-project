'use client';

import { Search, X } from 'lucide-react';
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
        <div className="relative">
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
            className={cn(CONTROL_HEIGHT, 'justify-self-start sm:col-span-2 lg:col-span-1')}
          >
            ล้างตัวกรอง
          </Button>
        )}
      </div>
    </div>
  );
}
