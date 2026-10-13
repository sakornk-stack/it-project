import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InstructorCourseTarget } from '../../../common/decorators/instructor-course-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { InstructorOrScopeGuard } from '../../../common/guards/instructor-or-scope.guard';
import { AssessmentCloMappingService } from './assessment-clo-mapping.service';
import { CreateAssessmentCloMappingDto } from './dto/create-assessment-clo-mapping.dto';

@ApiTags('assessment-evidence')
@Controller('assessment-clo-mappings')
export class AssessmentCloMappingController {
  constructor(private readonly assessmentCloMappingService: AssessmentCloMappingService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'body', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "Map an AssessmentDefinition to a CLO with a weight — this weight is the assessment's contribution to THIS CLO, distinct from CloPloMapping.weight one level up.",
  })
  @ApiResponse({ status: 201, description: 'Mapping created' })
  @ApiResponse({ status: 404, description: 'Assessment definition not found in the given course' })
  @ApiResponse({ status: 409, description: 'This assessment is already mapped to this CLO' })
  create(@Body() dto: CreateAssessmentCloMappingDto) {
    return this.assessmentCloMappingService.create(dto);
  }

  @Get('assessment-definition/:assessmentDefinitionId')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'query', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active CLO mappings for an assessment definition' })
  @ApiResponse({ status: 200, description: 'List of mappings' })
  findAllByDefinition(
    @Param('assessmentDefinitionId') assessmentDefinitionId: string,
    @Query('courseId') courseId: string,
  ) {
    return this.assessmentCloMappingService.findAllByDefinitionInCourse(
      assessmentDefinitionId,
      courseId,
    );
  }
}
