import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../modules/auth/request-user.interface';
import { ScopeResolverService } from './scope-resolver.service';

// Which curricula a caller may read curriculum content (courses, categories,
// requirements, prerequisites, CLO/PLO) from. Returns a Prisma where-clause so
// the DB does the filtering (CONVENTIONS §3a) — callers wrap it for their own
// model, e.g. `{ curriculum: where }` or `{ course: { curriculum: where } }`.
//
// - STAFF/ADMIN: curricula of the programs their scopes cover (none = empty).
// - INSTRUCTOR: curricula of the courses they are assigned to.
// - STUDENT: the curriculum of their own profile, plus the curricula of any
//   course they hold a record for (a student who changed curriculum keeps
//   seeing the names of the courses already on their transcript).
// - Anyone else (SUPER_ADMIN): no access to academic data → 403.
@Injectable()
export class CatalogScopeService {
  constructor(private readonly scopeResolver: ScopeResolverService) {}

  async curriculumWhere(user: RequestUser): Promise<Prisma.CurriculumWhereInput> {
    const clauses: Prisma.CurriculumWhereInput[] = [];

    if (user.roles.includes('STAFF') || user.roles.includes('ADMIN')) {
      const programIds = await this.scopeResolver.getCoveredProgramIds(user.userId);
      clauses.push({ programId: { in: programIds } });
    }
    if (user.roles.includes('INSTRUCTOR')) {
      clauses.push({
        courses: { some: { instructors: { some: { userId: user.userId } } } },
      });
    }
    if (user.roles.includes('STUDENT')) {
      clauses.push({ studentProfiles: { some: { userId: user.userId } } });
      clauses.push({
        courses: {
          some: {
            studentRecords: { some: { studentProfile: { userId: user.userId } } },
          },
        },
      });
    }

    if (clauses.length === 0) {
      throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงข้อมูลหลักสูตร');
    }
    return clauses.length === 1 ? clauses[0] : { OR: clauses };
  }
}
