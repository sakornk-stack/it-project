import type {
  AdminScopeCurriculumEntry,
  AdminScopeOverviewReport,
  AdminScopeProgram,
  CurriculumDataState,
} from '@eduanalyze-ai/shared-types';

// What the Admin curriculum pages derive from GET /dashboard/admin/scope-overview,
// kept apart from React so the filters and counts can be tested on their own.

export type CurriculumTab = 'ALL' | CurriculumDataState;

export const CURRICULUM_TAB_LABELS: Record<CurriculumTab, string> = {
  ALL: 'ทั้งหมด',
  HAS_STUDENTS: 'มีนักศึกษา',
  STRUCTURE_ONLY: 'มีแต่โครงสร้าง',
  EMPTY: 'ว่าง',
};

export const CURRICULUM_TAB_ORDER: CurriculumTab[] = [
  'ALL',
  'HAS_STUDENTS',
  'STRUCTURE_ONLY',
  'EMPTY',
];

export function countByTab(
  entries: readonly AdminScopeCurriculumEntry[],
): Record<CurriculumTab, number> {
  const counts: Record<CurriculumTab, number> = {
    ALL: entries.length,
    HAS_STUDENTS: 0,
    STRUCTURE_ONLY: 0,
    EMPTY: 0,
  };
  for (const entry of entries) counts[entry.dataState] += 1;
  return counts;
}

// An entry carries only its programCode; the department and faculty live on
// the scope's program list, so the two are joined here.
export type ProgramPlace = Pick<AdminScopeProgram, 'code' | 'departmentName' | 'facultyName'>;

export interface CurriculumPlace {
  departmentName: string;
  facultyName: string;
}

export function placeOf(
  entry: Pick<AdminScopeCurriculumEntry, 'programCode'>,
  programs: readonly ProgramPlace[],
): CurriculumPlace | null {
  const program = programs.find((p) => p.code === entry.programCode);
  return program
    ? { departmentName: program.departmentName, facultyName: program.facultyName }
    : null;
}

export function filterCurricula(
  entries: readonly AdminScopeCurriculumEntry[],
  tab: CurriculumTab,
  search: string,
): AdminScopeCurriculumEntry[] {
  const term = search.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (tab === 'ALL' || entry.dataState === tab) &&
      (term === '' ||
        entry.programName.toLowerCase().includes(term) ||
        entry.programCode.toLowerCase().includes(term) ||
        entry.version.toLowerCase().includes(term)),
  );
}

export function findCurriculum(
  entries: readonly AdminScopeCurriculumEntry[],
  curriculumId: string,
): AdminScopeCurriculumEntry | null {
  return entries.find((entry) => entry.curriculumId === curriculumId) ?? null;
}

// What both curriculum pages render, whichever API fed them: an Admin's
// scope overview or the Super Admin's system-wide one.
export interface CurriculumDirectory {
  entries: AdminScopeCurriculumEntry[];
  programs: ProgramPlace[];
  // Admin: 0 means no scope was granted. Super Admin: unscoped, so this is
  // the number of curricula (0 means the system has none).
  isEmpty: boolean;
}

export function directoryFromScopeOverview(report: AdminScopeOverviewReport): CurriculumDirectory {
  return {
    entries: report.curricula.entries,
    programs: report.scope.programs,
    isEmpty: report.scope.programCount === 0,
  };
}
