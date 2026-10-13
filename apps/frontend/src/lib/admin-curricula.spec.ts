import type { AdminScopeCurriculumEntry, AdminScopeProgram } from '@eduanalyze-ai/shared-types';
import type { AdminScopeOverviewReport } from '@eduanalyze-ai/shared-types';
import {
  countByTab,
  directoryFromScopeOverview,
  filterCurricula,
  findCurriculum,
  placeOf,
} from './admin-curricula';

function entry(
  id: string,
  dataState: AdminScopeCurriculumEntry['dataState'],
  programCode = 'CPE',
  programName = 'วิศวกรรมคอมพิวเตอร์',
): AdminScopeCurriculumEntry {
  return {
    curriculumId: id,
    version: '2565',
    effectiveYear: 2565,
    programCode,
    programName,
    dataState,
    studentCount: dataState === 'HAS_STUDENTS' ? 10 : 0,
    courseCount: 3,
    ploCount: 2,
  };
}

const ENTRIES = [
  entry('a', 'HAS_STUDENTS'),
  entry('b', 'STRUCTURE_ONLY', 'IT', 'เทคโนโลยีสารสนเทศ'),
  entry('c', 'EMPTY', 'DS', 'วิทยาการข้อมูล'),
  entry('d', 'HAS_STUDENTS', 'IT', 'เทคโนโลยีสารสนเทศ'),
];

describe('countByTab', () => {
  it('counts every tier and the total', () => {
    expect(countByTab(ENTRIES)).toEqual({
      ALL: 4,
      HAS_STUDENTS: 2,
      STRUCTURE_ONLY: 1,
      EMPTY: 1,
    });
  });
});

describe('filterCurricula', () => {
  it('filters by tab', () => {
    expect(filterCurricula(ENTRIES, 'HAS_STUDENTS', '').map((e) => e.curriculumId)).toEqual([
      'a',
      'd',
    ]);
  });
  it('searches name and code, case-insensitively', () => {
    expect(filterCurricula(ENTRIES, 'ALL', 'it').map((e) => e.curriculumId)).toEqual(['b', 'd']);
    expect(filterCurricula(ENTRIES, 'ALL', 'วิทยาการ').map((e) => e.curriculumId)).toEqual(['c']);
  });
  it('combines tab and search', () => {
    expect(filterCurricula(ENTRIES, 'EMPTY', 'it')).toEqual([]);
  });
});

describe('placeOf', () => {
  const programs: AdminScopeProgram[] = [
    {
      programId: 'p1',
      code: 'CPE',
      name: 'x',
      departmentName: 'ภาควิชาคอม',
      facultyName: 'คณะวิศวะ',
    },
  ];
  it('joins on the program code', () => {
    expect(placeOf({ programCode: 'CPE' }, programs)).toEqual({
      departmentName: 'ภาควิชาคอม',
      facultyName: 'คณะวิศวะ',
    });
  });
  it('returns null when the program is not in the list', () => {
    expect(placeOf({ programCode: 'ZZZ' }, programs)).toBeNull();
  });
});

describe('findCurriculum', () => {
  it('finds by id or returns null', () => {
    expect(findCurriculum(ENTRIES, 'c')?.programCode).toBe('DS');
    expect(findCurriculum(ENTRIES, 'nope')).toBeNull();
  });
});

describe('curriculum directory', () => {
  it('keeps the Admin scope list, programs and no-scope flag as they were', () => {
    const program: AdminScopeProgram = {
      programId: 'p',
      code: 'CPE',
      name: 'x',
      departmentName: 'd',
      facultyName: 'f',
    };
    const make = (programCount: number) =>
      ({
        scope: { programCount, programs: [program] },
        curricula: { entries: ENTRIES },
      }) as unknown as AdminScopeOverviewReport;
    expect(directoryFromScopeOverview(make(1))).toEqual({
      entries: ENTRIES,
      programs: [program],
      isEmpty: false,
    });
    expect(directoryFromScopeOverview(make(0)).isEmpty).toBe(true);
  });
});
