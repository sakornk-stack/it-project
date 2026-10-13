import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { LearningPathService } from './learning-path.service';

@ApiTags('academic-record')
@Controller('learning-path')
export class LearningPathController {
  constructor(private readonly learningPathService: LearningPathService) {}

  @Get(':studentProfileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Learning Path Planner — courses ready to take now (prerequisite-satisfied), missing required/elective, graduation readiness (PROJECT_CONTEXT.md §28)',
  })
  @ApiResponse({ status: 200, description: 'Learning path report' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  getLearningPath(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.learningPathService.getLearningPath(studentProfileId, user);
  }
}
