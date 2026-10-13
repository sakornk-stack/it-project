import type {
  CurriculumListItem,
  DepartmentListItem,
  FacultyListItem,
  ProgramListItem,
} from '@eduanalyze-ai/shared-types';
import { buildInactiveCalendarRows, buildInactiveOrgRows } from './inactive-items';

const faculty = (id: string, name: string, isActive: boolean): FacultyListItem => ({
  id,
  name,
  code: id.toUpperCase(),
  isActive,
});
const department = (id: string, facultyId: string, isActive: boolean): DepartmentListItem => ({
  id,
  name: `ภาค ${id}`,
  code: id.toUpperCase(),
  isActive,
  facultyId,
});
const program = (id: string, departmentId: string, isActive: boolean): ProgramListItem => ({
  id,
  name: `สาขา ${id}`,
  code: id.toUpperCase(),
  isActive,
  departmentId,
});
const empty = { faculties: [], departments: [], programs: [], curricula: [] };

describe('buildInactiveOrgRows', () => {
  it('a deactivated department under an active faculty can be reopened', () => {
    const rows = buildInactiveOrgRows(
      { ...empty, faculties: [faculty('f1', 'วิศวกรรมศาสตร์', true)] },
      { ...empty, departments: [department('d1', 'f1', false)] },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      level: 'ภาควิชา',
      path: 'คณะวิศวกรรมศาสตร์',
      blockedBy: null,
    });
  });

  it('says which parent to open first when the parent is deactivated too', () => {
    const rows = buildInactiveOrgRows(empty, {
      ...empty,
      faculties: [faculty('f1', 'วิศวกรรมศาสตร์', false)],
      departments: [department('d1', 'f1', false)],
      programs: [program('p1', 'd1', false)],
    });
    const byLevel = Object.fromEntries(rows.map((r) => [r.level, r]));
    expect(byLevel['คณะ'].blockedBy).toBeNull();
    expect(byLevel['ภาควิชา'].blockedBy).toBe('คณะวิศวกรรมศาสตร์');
    expect(byLevel['สาขา'].blockedBy).toBe('ภาควิชาภาค d1');
    expect(byLevel['สาขา'].path).toBe('วิศวกรรมศาสตร์ › ภาค d1');
  });

  it('names the whole chain above a curriculum', () => {
    const curriculum: CurriculumListItem = {
      id: 'c1',
      version: '2565',
      effectiveYear: 2565,
      programId: 'p1',
      isActive: false,
    } as CurriculumListItem;
    const rows = buildInactiveOrgRows(
      {
        ...empty,
        faculties: [faculty('f1', 'วิศวกรรมศาสตร์', true)],
        departments: [department('d1', 'f1', true)],
        programs: [program('p1', 'd1', true)],
      },
      { ...empty, curricula: [curriculum] },
    );
    expect(rows[0]).toMatchObject({
      title: 'ฉบับ 2565 (พ.ศ. 2565)',
      path: 'วิศวกรรมศาสตร์ › ภาค d1 › สาขา p1',
      blockedBy: null,
    });
  });

  it('has nothing to show when nothing is deactivated', () => {
    expect(buildInactiveOrgRows(empty, empty)).toEqual([]);
  });
});

const none = { records: 0, assessments: 0, activeSemesters: 0 };

describe('buildInactiveCalendarRows', () => {
  it('lists years newest first and semesters with their year', () => {
    const rows = buildInactiveCalendarRows(
      [{ id: 'y2', year: 2567, isActive: true }],
      [
        { id: 'y1', year: 2565, isActive: false, references: none },
        { id: 'y0', year: 2564, isActive: false, references: none },
      ],
      [{ id: 's1', term: 'FIRST', isActive: false, academicYearId: 'y2', references: none }],
    );
    expect(rows.map((r) => r.title)).toEqual(['ปีการศึกษา 2565', 'ปีการศึกษา 2564', 'ภาคต้น']);
    expect(rows[2]).toMatchObject({ path: 'ปีการศึกษา 2567', blockedBy: null });
  });

  it('a semester of a deactivated year waits for the year', () => {
    const rows = buildInactiveCalendarRows(
      [],
      [{ id: 'y1', year: 2565, isActive: false, references: none }],
      [{ id: 's1', term: 'SECOND', isActive: false, academicYearId: 'y1', references: none }],
    );
    expect(rows[1].blockedBy).toBe('ปีการศึกษา 2565');
  });

  it('turns permanent delete off with the counts when something still references it', () => {
    const rows = buildInactiveCalendarRows(
      [{ id: 'y2', year: 2567, isActive: true }],
      [
        {
          id: 'y1',
          year: 2565,
          isActive: false,
          references: { ...none, records: 12, assessments: 3 },
        },
      ],
      [{ id: 's1', term: 'FIRST', isActive: false, academicYearId: 'y2', references: none }],
    );
    expect(rows[0].permanentDelete?.blockedReason).toBe(
      'ลบถาวรไม่ได้: ยังมีผลการเรียน 12 รายการ และการประเมิน 3 รายการ อ้างอิงอยู่',
    );
    expect(rows[1].permanentDelete?.blockedReason).toBeNull();
  });
});
