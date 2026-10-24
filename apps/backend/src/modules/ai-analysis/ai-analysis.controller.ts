import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../auth/request-user.interface';
import { AiAnalysisService } from './ai-analysis.service';

@ApiTags('ai-analysis')
@Controller('ai-analysis')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Get('student/:studentProfileId')
  // Each call sends this student's grade data to Anthropic and costs money,
  // so it gets the same tight per-IP limit as login (global default is 100/min).
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'AI Skill Analysis — hedged Thai-language interpretation of already-computed GPA/CLO/PLO/learning-path data (PROJECT_CONTEXT.md §25-26)',
  })
  @ApiResponse({ status: 200, description: 'AI skill analysis report' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  @ApiResponse({
    status: 503,
    description: 'AI analysis service temporarily unavailable',
  })
  getStudentAnalysis(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.aiAnalysisService.getStudentAnalysis(studentProfileId, user);
  }

  @Get('student/:studentProfileId/careers')
  // Same cost and data-sharing profile as the skill analysis: same limit.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'AI career suggestions — careers the student’s passed courses and PLO results point to, with the courses that support each (hedged Thai, no new numbers)',
  })
  @ApiResponse({ status: 200, description: 'AI career suggestions' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  @ApiResponse({
    status: 503,
    description: 'AI analysis service temporarily unavailable',
  })
  getCareerSuggestions(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.aiAnalysisService.getCareerSuggestions(studentProfileId, user);
  }
}
