import type { UserScope } from '@eduanalyze-ai/shared-types';

interface Named {
  id: string;
  name: string;
}

export interface ScopeOrgNames {
  faculties: Named[];
  departments: (Named & { facultyId: string })[];
  programs: (Named & { departmentId: string })[];
}

// The units above a scope, highest first: a program sits under its department
// and faculty, a department under its faculty, a faculty under nothing. A unit
// the lists do not know (or that has not loaded) is simply left out.
export function scopeAncestorNames(scope: UserScope, org: ScopeOrgNames): string[] {
  if (scope.level === 'FACULTY') return [];
  const program =
    scope.level === 'PROGRAM' ? org.programs.find((p) => p.id === scope.programId) : undefined;
  const departmentId = scope.level === 'DEPARTMENT' ? scope.departmentId : program?.departmentId;
  const department = org.departments.find((d) => d.id === departmentId);
  const faculty = org.faculties.find((f) => f.id === department?.facultyId);
  return [faculty?.name, scope.level === 'PROGRAM' ? department?.name : undefined].filter(
    (name): name is string => !!name,
  );
}
