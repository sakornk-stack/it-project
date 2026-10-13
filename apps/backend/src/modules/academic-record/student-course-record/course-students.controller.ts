import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { InstructorCourseTarget } from '../../../common/decorators/instructor-course-target.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InstructorOrScopeGuard } from '../../../common/guards/instructor-or-scope.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentCourseRecordService } from './student-course-record.service';

// Separate controller (not CourseController) — StudentCourseRecordModule
// already imports CourseModule, so the reverse import needed to reach
// StudentCourseRecordService from CourseController would be circular.
// Shares the /courses URL space via its own @Controller('courses') here.
@ApiTags('courses')
@Controller('courses')
export class CourseStudentsController {
  constructor(
    private readonly studentCourseRecordService: StudentCourseRecordService,
  ) {}

  @Get(':courseId/students')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Student roster for a course — studentCode/fullName/latest grade only (PROJECT_CONTEXT.md §9)',
  })
  @ApiResponse({ status: 200, description: 'Student roster for the course' })
  @ApiResponse({ status: 403, description: 'Not assigned to this course / out of scope' })
  @ApiResponse({ status: 404, description: 'Course not found or inactive' })
  getStudentsForCourse(@Param('courseId') courseId: string) {
    return this.studentCourseRecordService.getStudentRosterForCourse(courseId);
  }

  @Get(':courseId/students/:studentProfileId/timeline')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "A student's grades in every course the requesting instructor teaches — never the student's full transcript. :courseId only gates access (must teach at least this course); the course list used is always this instructor's own, resolved server-side.",
  })
  @ApiResponse({ status: 200, description: 'Timeline scoped to the requesting instructor' })
  @ApiResponse({ status: 403, description: 'Not assigned to :courseId' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  getStudentTimeline(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.studentCourseRecordService.getStudentTimelineWithInstructor(
      studentProfileId,
      user.userId,
    );
  }
}
