import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { CourseAssessmentService } from './course-assessment.service';
import { CreateCourseAssessmentDto } from './dto/create-course-assessment.dto';
import { UpdateCourseAssessmentDto } from './dto/update-course-assessment.dto';

@ApiTags('curriculum-content')
@Controller('course-assessments')
export class CourseAssessmentController {
  constructor(
    private readonly courseAssessmentService: CourseAssessmentService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Submit a self-assessment against a course\'s CLOs (1-5 scale) — supplementary to Grade-based Achievement, never replaces it (PROJECT_CONTEXT.md §27)',
  })
  @ApiResponse({ status: 201, description: 'Assessment submitted' })
  @ApiResponse({ status: 400, description: 'Course not taken yet, or a CLO does not belong to this course' })
  @ApiResponse({ status: 409, description: 'Already submitted — use PATCH to revise' })
  create(@Body() dto: CreateCourseAssessmentDto, @CurrentUser() user: RequestUser) {
    return this.courseAssessmentService.create(dto, user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "List the current student's own assessments plus how many assessable courses are still pending",
  })
  @ApiResponse({ status: 200, description: 'Own assessments and pending count' })
  findAllOwn(@CurrentUser() user: RequestUser) {
    return this.courseAssessmentService.findAllOwn(user);
  }

  @Get('course/:courseId/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get the current student's own assessment for a course" })
  @ApiResponse({ status: 200, description: 'Own assessment' })
  @ApiResponse({ status: 404, description: 'No assessment submitted for this course' })
  findOwn(@Param('courseId') courseId: string, @CurrentUser() user: RequestUser) {
    return this.courseAssessmentService.findOwn(courseId, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revise a previously submitted assessment (replaces all CLO scores)' })
  @ApiResponse({ status: 200, description: 'Assessment revised' })
  @ApiResponse({ status: 400, description: 'A CLO does not belong to this assessment\'s course' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseAssessmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.courseAssessmentService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a submitted assessment' })
  @ApiResponse({ status: 200, description: 'Assessment deleted' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.courseAssessmentService.remove(id, user);
  }

  @Get('course/:courseId/aggregate')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorOrScopeGuard)
  @Roles('ADMIN', 'INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Aggregate Course Assessment view (average score per CLO, submission count) — numeric only, no individual comments or student identity',
  })
  @ApiResponse({ status: 200, description: 'Aggregate assessment report' })
  @ApiResponse({ status: 403, description: 'Not assigned to this course, or no scope covering it' })
  @ApiResponse({ status: 404, description: 'Course not found or inactive' })
  getAggregate(@Param('courseId') courseId: string) {
    return this.courseAssessmentService.getAggregateForCourse(courseId);
  }
}
