import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ScopeTarget } from '../../../common/decorators/scope-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentProfileService } from './student-profile.service';

@ApiTags('users')
@Controller('student-profiles')
export class StudentProfilesController {
  constructor(private readonly studentProfileService: StudentProfileService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current student’s own profile' })
  @ApiResponse({ status: 200, description: 'Own student profile' })
  @ApiResponse({ status: 404, description: 'No student profile found for this user' })
  getMe(@CurrentUser() user: RequestUser) {
    return this.studentProfileService.findByUserId(user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'List student profiles — SUPER_ADMIN sees all, ADMIN/STAFF see only students in programs their scope covers (PROJECT_CONTEXT.md §10)',
  })
  @ApiResponse({ status: 200, description: 'List of student profiles' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.studentProfileService.findAllScoped(user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN', 'STAFF')
  @ScopeTarget('studentProfile', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a student profile by id' })
  @ApiResponse({ status: 200, description: 'Student profile found' })
  @ApiResponse({ status: 403, description: 'No scope covering this student' })
  @ApiResponse({ status: 404, description: 'Student profile not found or inactive' })
  findOne(@Param('id') id: string) {
    return this.studentProfileService.findActiveByIdOrThrow(id);
  }
}
