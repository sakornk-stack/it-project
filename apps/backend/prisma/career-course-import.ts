// Pure helpers for import-career-courses.ts (no database, no I/O) so the
// --curriculum scoping rules can be unit-tested by career-course-import.spec.ts.

export type CurriculumVersion = '2569' | '2564';

export interface CareerImportOptions {
  // undefined = legacy mode: file = 2569, copied to 2564 by course name, additions loaded.
  curriculum?: CurriculumVersion;
  errors: string[];
}

export function parseCareerImportOptions(argv: string[]): CareerImportOptions {
  const errors: string[] = [];
  const given = argv.filter((a) => a === '--curriculum' || a.startsWith('--curriculum='));
  let curriculum: CurriculumVersion | undefined;
  if (given.length > 1) {
    errors.push('--curriculum ระบุได้ครั้งเดียว');
  } else if (given.length === 1) {
    const arg = given[0];
    // `--curriculum 2564` (no "=") would otherwise be ignored and silently run in legacy mode.
    if (!arg.includes('=')) {
      errors.push('--curriculum ต้องเขียนเป็น --curriculum=2569 หรือ --curriculum=2564');
    } else {
      const value = arg.slice('--curriculum='.length);
      if (value === '2569' || value === '2564') curriculum = value;
      else errors.push(`--curriculum ต้องเป็น 2569 หรือ 2564 เท่านั้น (ได้รับ "${value}")`);
    }
  }
  if (given.length > 0 && argv.some((a) => a.startsWith('--additions-file'))) {
    errors.push(
      '--curriculum ใช้ร่วมกับ --additions-file ไม่ได้ (additions ระบุปีของตัวเองอยู่แล้ว)',
    );
  }
  return { curriculum, errors };
}

// A row's curriculum cell may be empty (or the column absent); otherwise it has to match
// the year being imported. Legacy mode ignores the column.
export function rowCurriculumError(
  cell: string | undefined,
  curriculum: CurriculumVersion | undefined,
): 'curriculum-mismatch' | null {
  if (!curriculum) return null;
  const value = (cell ?? '').trim();
  return value === '' || value === curriculum ? null : 'curriculum-mismatch';
}

// Course ids whose links may be soft-deleted by a run. Links are not tied to a file, so
// this is the only boundary that keeps a one-year import from closing the other year.
export function courseIdsInScope(
  curriculum: CurriculumVersion | undefined,
  sourceCourseIds: string[],
  targetCourseIds: string[],
): Set<string> {
  if (curriculum === '2569') return new Set(sourceCourseIds);
  if (curriculum === '2564') return new Set(targetCourseIds);
  return new Set([...sourceCourseIds, ...targetCourseIds]);
}

// Active links of a career that fall inside the run's scope but are not asked for.
export function selectStaleLinks<T extends { courseId: string }>(
  activeLinks: T[],
  scope: Set<string>,
  wantedCourseIds: Set<string> | undefined,
): T[] {
  return activeLinks.filter((l) => scope.has(l.courseId) && !wantedCourseIds?.has(l.courseId));
}

// A career that already belongs to a group gets its sortOrder from import-career-groups.ts
// (position in the groups file); re-running the course import must not overwrite it.
// Ungrouped or new careers keep the old rule: position in the course file.
export function careerSortOrder(
  found: { sortOrder: number; groupId: string | null } | null,
  fileIndex: number,
): number {
  return found?.groupId ? found.sortOrder : fileIndex;
}
