import { Controller, Get, Param, Put, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InstructorCourseTarget } from '../../../common/decorators/instructor-course-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { InstructorGuard } from '../../../common/guards/instructor.guard';
import { InstructorOrScopeGuard } from '../../../common/guards/instructor-or-scope.guard';
import { StudentAssessmentScoreService } from './student-assessment-score.service';
import { AssessmentCloMappingService } from './assessment-clo-mapping.service';
import { BulkUpsertStudentAssessmentScoresDto } from './dto/bulk-upsert-student-assessment-scores.dto';
import { UpsertStudentAssessmentScoreDto } from './dto/upsert-student-assessment-score.dto';

@ApiTags('assessment-evidence')
@Controller('student-assessment-scores')
export class StudentAssessmentScoreController {
  constructor(
    private readonly studentAssessmentScoreService: StudentAssessmentScoreService,
    private readonly assessmentCloMappingService: AssessmentCloMappingService,
  ) {}

  @Put()
  // Writing scores and their structure is the assigned instructor's alone; ADMIN keeps
  // read access below but no longer writes (policy 2026-10).
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorGuard)
  @Roles('INSTRUCTOR')
  @InstructorCourseTarget({ from: 'body', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Record (or replace) one score — keyed by (assessmentCloMappingId, studentCourseRecordId), so a retake gets its own independent score, never merged with a prior attempt.',
  })
  @ApiResponse({ status: 200, description: 'Score recorded' })
  @ApiResponse({ status: 400, description: 'score presence does not match status' })
  upsert(@Body() dto: UpsertStudentAssessmentScoreDto) {
    return this.studentAssessmentScoreService.upsert(dto);
  }

  @Put('bulk')
  // Writing scores and their structure is the assigned instructor's alone; ADMIN keeps
  // read access below but no longer writes (policy 2026-10).
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorGuard)
  @Roles('INSTRUCTOR')
  @InstructorCourseTarget({ from: 'body', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Record the same scores against several CLO mappings of one assessment — all-or-nothing: any invalid item rejects the whole batch and nothing is written.',
  })
  @ApiResponse({ status: 200, description: 'All scores recorded' })
  @ApiResponse({ status: 400, description: 'Invalid item(s) — nothing was saved' })
  @ApiResponse({ status: 404, description: 'Assessment or CLO mapping not found in course' })
  bulkUpsert(@Body() dto: BulkUpsertStudentAssessmentScoresDto) {
    return this.studentAssessmentScoreService.bulkUpsert(dto);
  }

  @Get('clo-mapping/:assessmentCloMappingId')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'query', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List every student score recorded for one assessment-CLO mapping' })
  @ApiResponse({ status: 200, description: 'List of scores' })
  async findAllByMapping(
    @Param('assessmentCloMappingId') assessmentCloMappingId: string,
    @Query('courseId') courseId: string,
  ) {
    await this.assessmentCloMappingService.assertBelongsToCourse(assessmentCloMappingId, courseId);
    return this.studentAssessmentScoreService.findAllByMapping(assessmentCloMappingId);
  }
}
