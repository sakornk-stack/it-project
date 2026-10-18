import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeTarget } from '../../common/decorators/scope-target.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { EmailService } from '../../common/email/email.service';
import { RequestUser } from './request-user.interface';
import { StudentInvitationService } from './student-invitation.service';
import { CreateStudentInvitationDto } from './dto/create-student-invitation.dto';

@ApiTags('auth')
@Controller('student-invitations')
export class StudentInvitationController {
  constructor(
    private readonly studentInvitationService: StudentInvitationService,
    private readonly emailService: EmailService,
  ) {}

  // STAFF-only, matching the original ask — the inverse of POST /users
  // being ADMIN/SUPER_ADMIN-only with STAFF excluded. ScopeGuard checks
  // body.programId against the caller's own scope, same posture as
  // POST /course-instructors.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('program', { from: 'body', key: 'programId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Invite a prospective STUDENT — creates a token-gated draft, not an account; the invited person still self-registers via /auth/register',
  })
  @ApiResponse({ status: 201, description: 'Invitation created and emailed' })
  @ApiResponse({ status: 400, description: 'Curriculum does not belong to program' })
  @ApiResponse({ status: 403, description: 'No scope covering this program' })
  @ApiResponse({ status: 409, description: 'Student code or email already in use' })
  async create(
    @Body() dto: CreateStudentInvitationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const token = await this.studentInvitationService.create(dto, user.userId);
    await this.emailService
      .sendStudentInvitationEmail(dto.email, token, dto.fullName)
      .catch(() => undefined);
    return { email: dto.email, studentCode: dto.studentCode };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List pending student invitations within the caller's scope",
  })
  @ApiResponse({ status: 200, description: 'Pending invitations' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.studentInvitationService.findAllInScope(user);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('studentInvitation', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reissue a fresh token+expiry and resend the invitation email' })
  @ApiResponse({ status: 201, description: 'Invitation resent' })
  @ApiResponse({ status: 403, description: 'No scope covering this invitation' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async resend(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const { token, email, fullName } = await this.studentInvitationService.resend(
      id,
      user.userId,
    );
    await this.emailService
      .sendStudentInvitationEmail(email, token, fullName)
      .catch(() => undefined);
    return { resent: true, email };
  }

  // Same guard chain as resend. Nothing for ADMIN/SUPER_ADMIN: invitations are
  // STAFF work (pinned in roles-table.spec.ts).
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('studentInvitation', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cancel a pending student invitation (its link stops working); audited',
  })
  @ApiResponse({ status: 204, description: 'Invitation cancelled' })
  @ApiResponse({ status: 403, description: 'No scope covering this invitation' })
  @ApiResponse({ status: 404, description: 'Invitation not found, already used or cancelled' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.studentInvitationService.cancel(id, user);
  }
}
