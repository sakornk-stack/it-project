import type { UserScope } from '@eduanalyze-ai/shared-types';
import { scopeAncestorNames, type ScopeOrgNames } from './scope-hierarchy';

const org: ScopeOrgNames = {
  faculties: [{ id: 'f1', name: 'คณะวิทยาศาสตร์' }],
  departments: [{ id: 'd1', name: 'ภาควิชาคอมพิวเตอร์', facultyId: 'f1' }],
  programs: [{ id: 'p1', name: 'สาขาวิทยาการคอมพิวเตอร์', departmentId: 'd1' }],
};

function scope(level: UserScope['level'], id: string): UserScope {
  return {
    id: `s-${id}`,
    userId: 'u',
    level,
    facultyId: level === 'FACULTY' ? id : null,
    departmentId: level === 'DEPARTMENT' ? id : null,
    programId: level === 'PROGRAM' ? id : null,
    createdAt: '',
  };
}

describe('scopeAncestorNames', () => {
  it('has nothing above a faculty', () => {
    expect(scopeAncestorNames(scope('FACULTY', 'f1'), org)).toEqual([]);
  });

  it('names the faculty above a department', () => {
    expect(scopeAncestorNames(scope('DEPARTMENT', 'd1'), org)).toEqual(['คณะวิทยาศาสตร์']);
  });

  it('names the faculty then the department above a program', () => {
    expect(scopeAncestorNames(scope('PROGRAM', 'p1'), org)).toEqual([
      'คณะวิทยาศาสตร์',
      'ภาควิชาคอมพิวเตอร์',
    ]);
  });

  it('leaves out units the lists do not know', () => {
    expect(scopeAncestorNames(scope('PROGRAM', 'p9'), org)).toEqual([]);
    expect(
      scopeAncestorNames(scope('PROGRAM', 'p1'), {
        faculties: [],
        departments: [],
        programs: org.programs,
      }),
    ).toEqual([]);
  });
});
