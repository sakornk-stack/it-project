import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InstructorCourseTarget } from '../../../common/decorators/instructor-course-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { InstructorOrScopeGuard } from '../../../common/guards/instructor-or-scope.guard';
import { AssessmentDefinitionService } from './assessment-definition.service';
import { CreateAssessmentDefinitionDto } from './dto/create-assessment-definition.dto';

@ApiTags('assessment-evidence')
@Controller('assessment-definitions')
export class AssessmentDefinitionController {
  constructor(private readonly assessmentDefinitionService: AssessmentDefinitionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'body', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Create an AssessmentDefinition (Evidence-based CLO/PLO infrastructure, Phase 1) — scoped to a specific Course + Semester offering.',
  })
  @ApiResponse({ status: 201, description: 'Assessment definition created' })
  @ApiResponse({ status: 403, description: 'Not assigned to this course and no scope covering it' })
  create(@Body() dto: CreateAssessmentDefinitionDto) {
    return this.assessmentDefinitionService.create(dto);
  }

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active assessment definitions for a course' })
  @ApiResponse({ status: 200, description: 'List of assessment definitions' })
  findAllByCourse(@Param('courseId') courseId: string) {
    return this.assessmentDefinitionService.findAllByCourse(courseId);
  }
}
