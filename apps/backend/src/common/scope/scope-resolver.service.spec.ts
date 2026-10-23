import { PrismaService } from '../../prisma/prisma.service';
import { EffectiveScope, ScopeAncestry, ScopeResolverService } from './scope-resolver.service';

const service = new ScopeResolverService({} as PrismaService);

const facultyScope = (facultyId: string): EffectiveScope => ({
  level: 'FACULTY',
  facultyId,
  departmentId: null,
  programId: null,
});
const departmentScope = (departmentId: string): EffectiveScope => ({
  level: 'DEPARTMENT',
  facultyId: null,
  departmentId,
  programId: null,
});
const programScope = (programId: string): EffectiveScope => ({
  level: 'PROGRAM',
  facultyId: null,
  departmentId: null,
  programId,
});

// Faculty F1 > Department D1 > Program P1, plus sibling P2 (in D1),
// D2 (in F1) and F2 elsewhere.
const faculty1: ScopeAncestry = { facultyId: 'F1', departmentId: null, programId: null };
const department1: ScopeAncestry = { facultyId: 'F1', departmentId: 'D1', programId: null };
const department2: ScopeAncestry = { facultyId: 'F1', departmentId: 'D2', programId: null };
const program1: ScopeAncestry = { facultyId: 'F1', departmentId: 'D1', programId: 'P1' };
const program2: ScopeAncestry = { facultyId: 'F1', departmentId: 'D1', programId: 'P2' };
const otherFacultyProgram: ScopeAncestry = { facultyId: 'F2', departmentId: 'D9', programId: 'P9' };

describe('ScopeResolverService.isCovered', () => {
  it('FACULTY scope covers its child departments and programs', () => {
    const scopes = [facultyScope('F1')];
    expect(service.isCovered(faculty1, scopes)).toBe(true);
    expect(service.isCovered(department2, scopes)).toBe(true);
    expect(service.isCovered(program1, scopes)).toBe(true);
  });

  it('FACULTY scope does not cover another faculty', () => {
    expect(service.isCovered(otherFacultyProgram, [facultyScope('F1')])).toBe(false);
  });

  it('DEPARTMENT scope covers its child programs only', () => {
    const scopes = [departmentScope('D1')];
    expect(service.isCovered(department1, scopes)).toBe(true);
    expect(service.isCovered(program1, scopes)).toBe(true);
    expect(service.isCovered(department2, scopes)).toBe(false);
    expect(service.isCovered(faculty1, scopes)).toBe(false);
  });

  it('PROGRAM scope covers only that program', () => {
    const scopes = [programScope('P1')];
    expect(service.isCovered(program1, scopes)).toBe(true);
    expect(service.isCovered(program2, scopes)).toBe(false);
    expect(service.isCovered(department1, scopes)).toBe(false);
  });

  it('no scopes covers nothing', () => {
    expect(service.isCovered(program1, [])).toBe(false);
  });

  it('any one matching scope is enough', () => {
    expect(service.isCovered(program2, [programScope('P1'), departmentScope('D1')])).toBe(true);
  });
});

describe('ScopeResolverService.resolveScopeRowAncestry', () => {
  // A stored UserScope row only fills its own level's column.
  const prisma = {
    program: {
      findUnique: jest.fn().mockResolvedValue({ departmentId: 'D1', department: { facultyId: 'F1' } }),
    },
    department: { findUnique: jest.fn().mockResolvedValue({ facultyId: 'F1' }) },
  };
  const resolver = new ScopeResolverService(prisma as unknown as PrismaService);
  const programRow = { level: 'PROGRAM' as const, facultyId: null, departmentId: null, programId: 'P1' };
  const departmentRow = { level: 'DEPARTMENT' as const, facultyId: null, departmentId: 'D1', programId: null };

  it('fills a PROGRAM row with its department and faculty', async () => {
    await expect(resolver.resolveScopeRowAncestry(programRow)).resolves.toEqual(program1);
  });

  it('fills a DEPARTMENT row with its faculty', async () => {
    await expect(resolver.resolveScopeRowAncestry(departmentRow)).resolves.toEqual(department1);
  });

  it('lets a FACULTY-level ADMIN cover a PROGRAM-level user (raw row alone would not)', async () => {
    const adminScopes = [facultyScope('F1')];
    expect(resolver.isCovered(programRow, adminScopes)).toBe(false);
    expect(resolver.isCovered(await resolver.resolveScopeRowAncestry(programRow), adminScopes)).toBe(true);
  });
});
