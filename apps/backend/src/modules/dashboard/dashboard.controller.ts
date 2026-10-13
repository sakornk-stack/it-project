import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeTarget } from '../../common/decorators/scope-target.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { RequestUser } from '../auth/request-user.interface';
import { RiskLevel } from '../academic-record/student-course-record/grade-point.constant';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('student/:studentProfileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Student Dashboard — GPA, credits, progress %, graduation readiness, PLO radar, recent courses, missing requirements (PROJECT_CONTEXT.md §29)',
  })
  @ApiResponse({ status: 200, description: 'Student dashboard report' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  getStudentDashboard(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dashboardService.getStudentDashboard(studentProfileId, user);
  }

  @Get('instructor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "Instructor Dashboard — the current instructor's own courses with student count, CLO/PLO achievement, Course Assessment aggregate (PROJECT_CONTEXT.md §30)",
  })
  @ApiResponse({ status: 200, description: 'Instructor dashboard report' })
  getInstructorDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getInstructorDashboard(user);
  }

  // "My Courses" grouped by academic year -> semester for the teaching
  // schedule view — a separate endpoint from getInstructorDashboard above
  // rather than an added field on its response (see dashboard.service.ts
  // for why). Same self-scoped posture: no ScopeGuard needed.
  @Get('instructor/course-timeline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "Instructor course timeline — the current instructor's own courses grouped by academic year -> semester, with each course's predominant student year level",
  })
  @ApiResponse({ status: 200, description: 'Instructor course timeline report' })
  getInstructorCourseTimeline(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getInstructorCourseTimeline(user);
  }

  // No client-supplied courseId to validate against another user —
  // courseId here is only an optional narrowing filter, resolved against
  // this instructor's own course set inside the service. Same posture as
  // getInstructorDashboard above: @Roles('INSTRUCTOR') alone is enough.
  @Get('instructor/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'riskLevel', required: false, enum: ['CRITICAL', 'WATCH', 'NORMAL'] })
  @ApiOperation({
    summary:
      "Student Monitoring — one row per (student, course) pair across ALL of the instructor's own courses, filterable by course/risk level",
  })
  @ApiResponse({ status: 200, description: 'Instructor students report' })
  getInstructorStudents(
    @CurrentUser() user: RequestUser,
    @Query('courseId') courseId?: string,
    @Query('riskLevel') riskLevelParam?: RiskLevel,
  ) {
    return this.dashboardService.getInstructorStudents(
      user,
      courseId,
      riskLevelParam,
    );
  }

  @Get('instructor/year-levels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "Year Level Overview — students grouped by year level (1-4), scoped to only students who have taken a course with this instructor",
  })
  @ApiResponse({ status: 200, description: 'Instructor year-levels report' })
  getInstructorYearLevels(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getInstructorYearLevels(user);
  }

  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Staff Dashboard — program/curriculum overview within scope: student count, average GPA, courses missing CLOs',
  })
  @ApiResponse({ status: 200, description: 'Staff overview report' })
  getStaffOverview(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getStaffOverview(user);
  }

  @Get('staff/students')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Staff student directory — every student in scope with GPA and risk level, for filtering the directory by risk',
  })
  @ApiResponse({ status: 200, description: 'Risk-annotated student list' })
  getStaffStudentRisk(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getStaffStudentRisk(user);
  }

  @Get('staff/year-levels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Staff Year Level Overview — active students in scope grouped by year level (1-4), each with GPA and risk level',
  })
  @ApiResponse({ status: 200, description: 'Staff year-levels report' })
  getStaffYearLevels(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getStaffYearLevels(user);
  }

  @Get('curriculum/:curriculumId')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('curriculum', { from: 'param', key: 'curriculumId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Curriculum/Program Analytics Dashboard — student count, average GPA, graduation readiness, students at risk, PLO radar, cohort comparison, course analytics, lowest CLO/PLO (PROJECT_CONTEXT.md §31)',
  })
  @ApiResponse({ status: 200, description: 'Curriculum dashboard report' })
  @ApiResponse({ status: 403, description: 'No scope covering this curriculum' })
  @ApiResponse({ status: 404, description: 'Curriculum not found or inactive' })
  getCurriculumDashboard(@Param('curriculumId') curriculumId: string) {
    return this.dashboardService.getCurriculumDashboard(curriculumId);
  }

  // Self-scoped, same posture as the STAFF dashboard routes above — scope
  // comes from the caller's own userId (via ScopeResolverService), not a
  // client-supplied id, so no ScopeGuard/@ScopeTarget is needed.
  @Get('admin/scope-overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "ADMIN Scope Overview — the Faculty/Department/Program footprint the requester's own UserScope covers, user counts by role within it, and the same 3-tier curriculum classification as the system-wide dashboard, narrowed to scope",
  })
  @ApiResponse({ status: 200, description: 'Admin scope overview report' })
  getAdminScopeOverview(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getAdminScopeOverview(user);
  }
}
