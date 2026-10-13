import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  INSTRUCTOR_COURSE_TARGET_KEY,
  InstructorCourseSource,
} from '../decorators/instructor-course-target.decorator';
import { RequestUser } from '../../modules/auth/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeResolverService } from '../scope/scope-resolver.service';

// NestJS ANDs every guard in @UseGuards() — stacking InstructorGuard and
// ScopeGuard on one route would require an ADMIN to also be a
// CourseInstructor (and an INSTRUCTOR to also hold a UserScope row),
// which is never true. This guard implements the real OR: allow if
// SUPER_ADMIN, OR an assigned CourseInstructor, OR a scope-covering
// ADMIN. Reuses @InstructorCourseTarget's metadata (courseId source) —
// no new decorator needed, both checks resolve the same courseId.
@Injectable()
export class InstructorOrScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly scopeResolverService: ScopeResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const source = this.reflector.getAllAndOverride<InstructorCourseSource>(
      INSTRUCTOR_COURSE_TARGET_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!source) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      params: Record<string, string>;
      body: Record<string, unknown>;
      query: Record<string, string>;
    }>();
    const user = request.user!;

    const courseId = (
      source.from === 'param'
        ? request.params[source.key]
        : source.from === 'query'
          ? request.query[source.key]
          : request.body[source.key]
    ) as string;

    if (user.roles.includes('INSTRUCTOR')) {
      const assignment = await this.prisma.courseInstructor.findUnique({
        where: { userId_courseId: { userId: user.userId, courseId } },
      });
      if (assignment) {
        return true;
      }
    }

    if (user.roles.includes('ADMIN')) {
      const ancestry = await this.scopeResolverService.resolveAncestry(
        'course',
        courseId,
      );
      const effectiveScopes = await this.scopeResolverService.getEffectiveScopes(
        user.userId,
      );
      if (this.scopeResolverService.isCovered(ancestry, effectiveScopes)) {
        return true;
      }
    }

    throw new ForbiddenException(
      'You are not assigned to this course and do not have scope covering it',
    );
  }
}
