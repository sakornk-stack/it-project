import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
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
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserActiveStatusDto } from './dto/update-user-active-status.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UserManagementService } from './user-management.service';

@ApiTags('users')
@Controller('users')
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Create an ADMIN/STAFF/INSTRUCTOR account (SUPER_ADMIN: any of these; ADMIN: STAFF only, scope required, must be within their own scope). Returns a system-generated temporary password once — relay it to the new user out-of-band; they should change it via PATCH /auth/change-password.',
  })
  @ApiResponse({ status: 201, description: 'User created, temporary password returned' })
  @ApiResponse({ status: 400, description: 'role:STUDENT rejected, or scope missing for ADMIN' })
  @ApiResponse({ status: 403, description: 'Role or scope outside what the requester may grant' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: RequestUser) {
    return this.userManagementService.createStaffOrAdmin(dto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'List non-STUDENT users — SUPER_ADMIN sees all, ADMIN sees only users within their own scope',
  })
  @ApiResponse({ status: 200, description: 'List of users' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.userManagementService.listUsers(user);
  }

  @Get('instructors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'List every INSTRUCTOR-role user in the system (not filtered by the requester scope, since instructors are tied to courses via CourseInstructor rather than UserScope; STAFF-reachable, unlike GET /users) — for picking an instructor to assign to a course. Returns id/fullName/email only.',
  })
  @ApiResponse({ status: 200, description: 'List of instructors' })
  findInstructors() {
    return this.userManagementService.listInstructors();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found or outside your scope' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.userManagementService.getOne(id, user);
  }

  @Patch(':id/active-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Suspend or reactivate a user. Never your own account (403). ADMIN: STAFF-only targets, and suspending requires every scope of the target to be inside the ADMIN scope (403 otherwise).',
  })
  @ApiResponse({ status: 200, description: 'Active status updated' })
  @ApiResponse({ status: 404, description: 'User not found or outside your scope' })
  updateActiveStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserActiveStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.userManagementService.updateActiveStatus(id, dto.isActive, user);
  }

  @Post(':id/resend-invitation')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Email a fresh password-setup link to a user who has not set a password yet (replaces any unused link; ADMIN: STAFF in own scope only)',
  })
  @ApiResponse({ status: 201, description: 'Password setup email sent' })
  @ApiResponse({ status: 403, description: 'Own account, or a target this role may not manage' })
  @ApiResponse({ status: 404, description: 'User not found or outside your scope' })
  @ApiResponse({ status: 409, description: 'User has already set a password' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 503, description: 'The email could not be sent' })
  resendInvitation(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.userManagementService.resendInvitation(id, user);
  }

  @Post(':id/roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign an additional role to a user (ADMIN: STAFF only)' })
  @ApiResponse({ status: 201, description: 'Role assigned' })
  @ApiResponse({ status: 404, description: 'User not found or outside your scope' })
  @ApiResponse({ status: 409, description: 'User already has this role' })
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.userManagementService.assignRole(id, dto.role, user);
  }

  @Delete(':id/roles/:role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a role from a user (ADMIN: STAFF only)' })
  @ApiResponse({ status: 200, description: 'Role revoked' })
  @ApiResponse({ status: 404, description: 'User not found, outside your scope, or does not have this role' })
  revokeRole(
    @Param('id') id: string,
    @Param('role', new ParseEnumPipe(Role)) role: Role,
    @CurrentUser() user: RequestUser,
  ) {
    return this.userManagementService.revokeRole(id, role, user);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Permanently delete a suspended, unreferenced account (SUPER_ADMIN). Never your own, a SUPER_ADMIN or a STUDENT account. Login data is deleted with it.',
  })
  @ApiResponse({ status: 204, description: 'User deleted' })
  @ApiResponse({ status: 403, description: 'Own account, a SUPER_ADMIN or a STUDENT account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description:
      'Account is still active, or still referenced (course instructor, grade entries, invitations)',
  })
  hardDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.userManagementService.hardDelete(id, user);
  }
}
