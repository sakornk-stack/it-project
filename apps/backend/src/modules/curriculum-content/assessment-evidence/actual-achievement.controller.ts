import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InstructorCourseTarget } from '../../../common/decorators/instructor-course-target.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { InstructorOrScopeGuard } from '../../../common/guards/instructor-or-scope.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { ActualAchievementService } from './actual-achievement.service';

@ApiTags('assessment-evidence')
@Controller()
export class ActualAchievementController {
  constructor(private readonly actualAchievementService: ActualAchievementService) {}

  @Get('actual-clo-achievement/course/:courseId/student-course-record/:studentCourseRecordId/clo/:cloId')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Evidence-based Actual CLO Achievement for one course attempt — completely separate from the existing grade-based CloAchievementService, does not affect it.',
  })
  @ApiResponse({ status: 200, description: 'Actual CLO achievement result (score/status/source/coverage)' })
  getActualCloForAttempt(
    @Param('courseId') courseId: string,
    @Param('studentCourseRecordId') studentCourseRecordId: string,
    @Param('cloId') cloId: string,
  ) {
    return this.actualAchievementService.computeActualCloForAttemptInCourse(
      courseId,
      studentCourseRecordId,
      cloId,
    );
  }

  @Get('actual-clo-achievement/course/:courseId/student-course-record/:studentCourseRecordId/clo/:cloId/gap')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Actual vs. self-assessment gap insight for one CLO — derived comparison only, never fed back into the actual calculation.',
  })
  @ApiResponse({ status: 200, description: 'Gap result (actual, selfAssessmentScore, gap)' })
  async getGapForAttempt(
    @Param('courseId') courseId: string,
    @Param('studentCourseRecordId') studentCourseRecordId: string,
    @Param('cloId') cloId: string,
  ) {
    // Re-verify the same course-ownership integrity check the CLO-only
    // route uses, since this route calls the service's un-course-scoped
    // gap method directly (it needs studentProfileId+courseId internally
    // for the self-assessment lookup, which computeActualCloForAttempt
    // alone does not need).
    await this.actualAchievementService.computeActualCloForAttemptInCourse(
      courseId,
      studentCourseRecordId,
      cloId,
    );
    return this.actualAchievementService.computeGapForAttempt(studentCourseRecordId, cloId);
  }

  @Get('actual-plo-achievement/student/:studentProfileId/plo/:ploId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'INSTRUCTOR', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Evidence-based Actual PLO Achievement for one student, aggregated across their latest attempt per course via the existing CloPloMapping. ' +
      'Authorized via ActualAchievementService.assertCanViewStudentPlo (service-layer, not a guard — see CONVENTIONS §3a): ' +
      'SUPER_ADMIN, the student themself, an INSTRUCTOR who taught them, or an ADMIN whose scope covers them. Anyone else gets 404, never 403.',
  })
  @ApiResponse({ status: 200, description: 'Actual PLO achievement result (score/status/source/coverage)' })
  @ApiResponse({ status: 404, description: 'Student profile not found, or not visible to the requester' })
  getActualPloForStudent(
    @Param('studentProfileId') studentProfileId: string,
    @Param('ploId') ploId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.actualAchievementService.computeActualPloForStudent(studentProfileId, ploId, user);
  }
}
