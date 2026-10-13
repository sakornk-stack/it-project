import type {
  AcademicYear,
  CurriculumListItem,
  DepartmentListItem,
  FacultyListItem,
  ProgramListItem,
  InactiveAcademicYear,
  InactiveSemester,
  Semester,
} from '@eduanalyze-ai/shared-types';
import { SEMESTER_TERM_LABELS } from '@/lib/grade-label';

export type InactiveLevel = 'คณะ' | 'ภาควิชา' | 'สาขา' | 'หลักสูตร' | 'ปีการศึกษา' | 'ภาคเรียน';

export interface InactiveRow {
  key: string;
  id: string;
  level: InactiveLevel;
  title: string;
  code?: string;
  // "อยู่ใน: คณะ… › ภาควิชา…" — empty for a top-level record.
  path: string;
  // Set when the parent is itself deactivated: the backend would refuse, so the
  // screen says what to open first instead of offering a button that cannot work.
  blockedBy: string | null;
  // Only years and semesters can be deleted for good. `blockedReason` is why the
  // button is off (null = allowed); the API re-checks either way.
  permanentDelete?: { blockedReason: string | null };
}

export function permanentDeleteBlockedReason(refs: {
  records: number;
  assessments: number;
  activeSemesters?: number;
}): string | null {
  const parts = [
    refs.activeSemesters ? `ภาคเรียนที่ใช้งานอยู่ ${refs.activeSemesters} ภาค` : null,
    refs.records ? `ผลการเรียน ${refs.records} รายการ` : null,
    refs.assessments ? `การประเมิน ${refs.assessments} รายการ` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `ลบถาวรไม่ได้: ยังมี${parts.join(' และ')} อ้างอิงอยู่` : null;
}

interface OrgLists {
  faculties: FacultyListItem[];
  departments: DepartmentListItem[];
  programs: ProgramListItem[];
  curricula: CurriculumListItem[];
}

const byId = <T extends { id: string }>(...lists: T[][]) =>
  new Map(lists.flat().map((item) => [item.id, item]));

// Deactivated organisation records, each with the chain above it. A parent may be
// active (in `active`) or deactivated too (in `inactive`).
export function buildInactiveOrgRows(active: OrgLists, inactive: OrgLists): InactiveRow[] {
  const faculties = byId(active.faculties, inactive.faculties);
  const departments = byId(active.departments, inactive.departments);
  const programs = byId(active.programs, inactive.programs);

  const facultyName = (id: string) => faculties.get(id)?.name;
  const chainOfDepartment = (id: string) => {
    const d = departments.get(id);
    if (!d) return [];
    return [facultyName(d.facultyId), d.name].filter(Boolean) as string[];
  };
  const chainOfProgram = (id: string) => {
    const p = programs.get(id);
    if (!p) return [];
    return [...chainOfDepartment(p.departmentId), p.name];
  };

  const rows: InactiveRow[] = [
    ...inactive.faculties.map((f) => ({
      key: `faculty-${f.id}`,
      id: f.id,
      level: 'คณะ' as const,
      title: f.name,
      code: f.code,
      path: '',
      blockedBy: null,
    })),
    ...inactive.departments.map((d) => {
      const parent = faculties.get(d.facultyId);
      return {
        key: `department-${d.id}`,
        id: d.id,
        level: 'ภาควิชา' as const,
        title: d.name,
        code: d.code,
        path: parent ? `คณะ${parent.name}` : '',
        blockedBy: parent && !parent.isActive ? `คณะ${parent.name}` : null,
      };
    }),
    ...inactive.programs.map((p) => {
      const parent = departments.get(p.departmentId);
      return {
        key: `program-${p.id}`,
        id: p.id,
        level: 'สาขา' as const,
        title: p.name,
        code: p.code,
        path: chainOfDepartment(p.departmentId).join(' › '),
        blockedBy: parent && !parent.isActive ? `ภาควิชา${parent.name}` : null,
      };
    }),
    ...inactive.curricula.map((c) => {
      const parent = programs.get(c.programId);
      return {
        key: `curriculum-${c.id}`,
        id: c.id,
        level: 'หลักสูตร' as const,
        title: `ฉบับ ${c.version} (พ.ศ. ${c.effectiveYear})`,
        path: chainOfProgram(c.programId).join(' › '),
        blockedBy: parent && !parent.isActive ? `สาขา${parent.name}` : null,
      };
    }),
  ];
  return rows;
}

// Deactivated academic years and semesters. A semester needs its year active first.
export function buildInactiveCalendarRows(
  activeYears: AcademicYear[],
  inactiveYears: InactiveAcademicYear[],
  inactiveSemesters: InactiveSemester[],
): InactiveRow[] {
  const years = byId(activeYears, inactiveYears);
  return [
    ...[...inactiveYears]
      .sort((a, b) => b.year - a.year)
      .map((y) => ({
        key: `year-${y.id}`,
        id: y.id,
        level: 'ปีการศึกษา' as const,
        title: `ปีการศึกษา ${y.year}`,
        path: '',
        blockedBy: null,
        permanentDelete: { blockedReason: permanentDeleteBlockedReason(y.references) },
      })),
    ...inactiveSemesters.map((s) => {
      const year = years.get(s.academicYearId);
      return {
        key: `semester-${s.id}`,
        id: s.id,
        level: 'ภาคเรียน' as const,
        title: SEMESTER_TERM_LABELS[s.term] ?? s.term,
        path: year ? `ปีการศึกษา ${year.year}` : '',
        blockedBy: year && !year.isActive ? `ปีการศึกษา ${year.year}` : null,
        permanentDelete: { blockedReason: permanentDeleteBlockedReason(s.references) },
      };
    }),
  ];
}
