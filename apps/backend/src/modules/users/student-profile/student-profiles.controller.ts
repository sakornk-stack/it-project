import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ScopeTarget } from '../../../common/decorators/scope-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { UpdateStudentActiveStatusDto } from './dto/update-student-active-status.dto';
import { UpdateStudentAdvisorDto } from './dto/update-student-advisor.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
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
  @ApiOperation({
    summary: 'Get a student profile by id, suspended ones included (user.isActive is sign-in)',
  })
  @ApiResponse({ status: 200, description: 'Student profile found' })
  @ApiResponse({ status: 403, description: 'No scope covering this student' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  findOne(@Param('id') id: string) {
    return this.studentProfileService.findInScopeById(id);
  }

  // Student account management is STAFF work within scope; ADMIN and
  // SUPER_ADMIN have no route here (pinned in roles-table.spec.ts).
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('studentProfile', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Correct a student’s program, curriculum or admission year (never the student code), with a reason; audited',
  })
  @ApiResponse({ status: 200, description: 'Student profile updated' })
  @ApiResponse({
    status: 400,
    description: 'Nothing changed, reason missing, curriculum not in program, or studentCode sent',
  })
  @ApiResponse({ status: 403, description: 'Current or new program outside your scope' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  @ApiResponse({
    status: 409,
    description: 'Student suspended, or has grades/assessments outside the new curriculum',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.studentProfileService.update(id, dto, user);
  }

  @Patch(':id/active-status')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('studentProfile', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Suspend or reactivate a student account (sign-in and directory status together), with a reason; audited. Never deletes.',
  })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Reason missing or too short' })
  @ApiResponse({ status: 403, description: 'No scope covering this student' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  @ApiResponse({ status: 409, description: 'Already in that state' })
  updateActiveStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStudentActiveStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.studentProfileService.updateActiveStatus(id, dto, user);
  }

  @Patch(':id/advisor')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('studentProfile', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Set, change or clear (null) a student’s academic advisor — an active INSTRUCTOR account; audited',
  })
  @ApiResponse({ status: 200, description: 'Advisor updated ({ id, advisor })' })
  @ApiResponse({
    status: 400,
    description: 'Nothing changed, or the user is not an active INSTRUCTOR',
  })
  @ApiResponse({ status: 403, description: 'No scope covering this student' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  @ApiResponse({ status: 409, description: 'Student suspended' })
  updateAdvisor(
    @Param('id') id: string,
    @Body() dto: UpdateStudentAdvisorDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.studentProfileService.updateAdvisor(id, dto, user);
  }

  @Get(':id/audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('studentProfile', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Read-only change history of a student (grades by staff/instructors, suspensions, profile edits), newest first',
  })
  @ApiResponse({ status: 200, description: 'Audit entries (actor name, never an email)' })
  @ApiResponse({ status: 403, description: 'No scope covering this student' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  findAuditLogs(@Param('id') id: string) {
    return this.studentProfileService.findHistory(id);
  }
}
