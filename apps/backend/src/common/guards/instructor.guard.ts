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

// Flat many-to-many membership check ("is this user assigned to this exact
// Course") — deliberately NOT built on ScopeGuard/ScopeResolverService,
// which model hierarchical Faculty/Department/Program containment. A
// CourseInstructor assignment has no ancestry to compute; it either exists
// for this (userId, courseId) pair or it doesn't.
@Injectable()
export class InstructorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
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
    const user = request.user;

    const courseId =
      source.from === 'param'
        ? request.params[source.key]
        : source.from === 'query'
          ? request.query[source.key]
          : (request.body[source.key] as string | undefined);

    const assignment = await this.prisma.courseInstructor.findUnique({
      where: {
        userId_courseId: { userId: user!.userId, courseId: courseId as string },
      },
    });

    if (!assignment) {
      // 403, not 404 — same reasoning as ScopeGuard: Course/achievement
      // data is structural academic content, not personal data (§3a
      // doesn't apply here).
      throw new ForbiddenException('You are not assigned to this course');
    }

    return true;
  }
}
