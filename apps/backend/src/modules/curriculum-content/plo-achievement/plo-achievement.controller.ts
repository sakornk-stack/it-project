import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InstructorCourseTarget } from '../../../common/decorators/instructor-course-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { InstructorGuard } from '../../../common/guards/instructor.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { ScopeTarget } from '../../../common/decorators/scope-target.decorator';
import { RequestUser } from '../../auth/request-user.interface';
import { PloAchievementService } from './plo-achievement.service';

@ApiTags('curriculum-content')
@Controller('plo-achievement')
export class PloAchievementController {
  constructor(private readonly ploAchievementService: PloAchievementService) {}

  @Get('student/:studentProfileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'PLO Achievement for a student — radar chart, strengths, areas for improvement (PROJECT_CONTEXT.md §23A/§24)',
  })
  @ApiResponse({ status: 200, description: 'Student PLO achievement report' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  calculateForStudent(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ploAchievementService.calculateForStudent(
      studentProfileId,
      user,
    );
  }

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorGuard)
  @Roles('INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'PLO Achievement for a course — weighted rollup of CLO achievement % per PLO (PROJECT_CONTEXT.md §23B)',
  })
  @ApiResponse({ status: 200, description: 'Course PLO achievement report' })
  @ApiResponse({ status: 403, description: 'Not assigned to this course' })
  @ApiResponse({ status: 404, description: 'Course not found or inactive' })
  calculateForCourse(@Param('courseId') courseId: string) {
    return this.ploAchievementService.calculateForCourse(courseId);
  }

  @Get('cohort/:curriculumId/:admissionYear')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('curriculum', { from: 'param', key: 'curriculumId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'PLO Achievement for a cohort (curriculum + admission year) — average GPA, average PLO radar, strengths/weaknesses (PROJECT_CONTEXT.md §23C)',
  })
  @ApiResponse({ status: 200, description: 'Cohort PLO achievement report' })
  @ApiResponse({ status: 404, description: 'Curriculum not found or inactive' })
  calculateForCohort(
    @Param('curriculumId') curriculumId: string,
    @Param('admissionYear', ParseIntPipe) admissionYear: number,
  ) {
    return this.ploAchievementService.calculateForCohort(
      curriculumId,
      admissionYear,
    );
  }

  @Get('curriculum/:curriculumId')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('curriculum', { from: 'param', key: 'curriculumId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'PLO Achievement for a whole curriculum — student count, average GPA, graduation readiness, students at risk, average PLO radar, lowest CLO/PLO, course analytics, cohort comparison (PROJECT_CONTEXT.md §23D)',
  })
  @ApiResponse({ status: 200, description: 'Curriculum PLO achievement report' })
  @ApiResponse({ status: 404, description: 'Curriculum not found or inactive' })
  calculateForCurriculum(@Param('curriculumId') curriculumId: string) {
    return this.ploAchievementService.calculateForCurriculum(curriculumId);
  }
}
