import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InstructorCourseTarget } from '../../../common/decorators/instructor-course-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { InstructorGuard } from '../../../common/guards/instructor.guard';
import { CloAchievementService } from './clo-achievement.service';

@ApiTags('curriculum-content')
@Controller('clo-achievement')
export class CloAchievementController {
  constructor(private readonly cloAchievementService: CloAchievementService) {}

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, RolesGuard, InstructorGuard)
  @Roles('INSTRUCTOR')
  @InstructorCourseTarget({ from: 'param', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'CLO Achievement for a course — % of students graded B or above (Grade-based Assessment, PROJECT_CONTEXT.md §22)',
  })
  @ApiResponse({ status: 200, description: 'CLO achievement report' })
  @ApiResponse({ status: 403, description: 'Not assigned to this course' })
  @ApiResponse({ status: 404, description: 'Course not found or inactive' })
  calculateForCourse(@Param('courseId') courseId: string) {
    return this.cloAchievementService.calculateForCourse(courseId);
  }
}
