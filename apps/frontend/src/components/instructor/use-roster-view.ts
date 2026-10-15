import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { StudentRosterEntry } from '@eduanalyze-ai/shared-types';
import { isLowGrade } from '@/lib/low-grade';
import {
  ALL,
  countPeople,
  sortPeopleBy,
  type GradeFilter,
  type PeopleSort,
} from '@/lib/student-directory';
import { usePagination } from '@/lib/use-pagination';

// What the roster shows: the grade filter and the search (kept in the URL), the sort,
// and the page of 12. Low grades come first, then by code, before the chosen sort.
export function useRosterView(roster: StudentRosterEntry[] | undefined) {
  // Filters live in the URL (?grade=low ?q=) so a reload or Back lands on the same
  // view; replace, not push, so filtering does not pile up history.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gradeFilter: GradeFilter = searchParams.get('grade') === 'low' ? 'LOW' : ALL;
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Low grades first, then by code.
  const ordered = useMemo(
    () =>
      [...(roster ?? [])].sort(
        (a, b) =>
          Number(isLowGrade(b.grade)) - Number(isLowGrade(a.grade)) ||
          a.studentCode.localeCompare(b.studentCode),
      ),
    [roster],
  );

  // Search narrows first and the counts follow it, so each button shows
  // how many people it would leave.
  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term === ''
      ? ordered
      : ordered.filter(
          (student) =>
            student.studentCode.toLowerCase().includes(term) ||
            student.fullName.toLowerCase().includes(term),
        );
  }, [ordered, search]);
  const counts = useMemo(
    () => countPeople(searched.map((s) => ({ hasLowGrade: isLowGrade(s.grade) }))),
    [searched],
  );
  const visibleRoster = useMemo(
    () => (gradeFilter === ALL ? searched : searched.filter((s) => isLowGrade(s.grade))),
    [searched, gradeFilter],
  );

  const isFiltered = search.trim() !== '' || gradeFilter !== ALL;

  const [sortKey, setSortKey] = useState<PeopleSort>('risk');
  const sorted = useMemo(() => sortPeopleBy(visibleRoster, sortKey), [visibleRoster, sortKey]);
  const pagination = usePagination(sorted, 12, `${search}|${gradeFilter}|${sortKey}`);

  function clearFilters() {
    setSearch('');
    updateParams({ grade: null, q: null });
  }

  return {
    gradeFilter,
    search,
    setSearch,
    updateParams,
    counts,
    visibleRoster,
    isFiltered,
    sortKey,
    setSortKey,
    sorted,
    pagination,
    clearFilters,
  };
}
