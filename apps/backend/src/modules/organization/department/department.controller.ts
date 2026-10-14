import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { Roles } from '../../../common/decorators/roles.decorator';
import { ScopeTarget } from '../../../common/decorators/scope-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('organization')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  // Public — see FacultyController's findAll for the reasoning.
  @Get()
  @ApiOperation({ summary: 'List active departments' })
  @ApiResponse({ status: 200, description: 'List of active departments' })
  findAll() {
    return this.departmentService.findAll();
  }

  // Registered before `:id` so "inactive" is never read as an id.
  @Get('inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List deactivated department records (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Deactivated department records' })
  findInactive() {
    return this.departmentService.findInactive();
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore a deactivated department (SUPER_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Department reactivated' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({
    status: 409,
    description: 'Already active, parent still deactivated, or the key is taken by an active record',
  })
  reactivate(@Param('id') id: string) {
    return this.departmentService.reactivate(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department by id' })
  @ApiResponse({ status: 200, description: 'Department found' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('SUPER_ADMIN')
  @ScopeTarget('faculty', { from: 'body', key: 'facultyId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a department' })
  @ApiResponse({ status: 201, description: 'Department created' })
  @ApiResponse({ status: 403, description: 'No scope covering this faculty' })
  @ApiResponse({ status: 404, description: 'Faculty not found or inactive' })
  @ApiResponse({
    status: 409,
    description: 'Department code already in use within this faculty',
  })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('SUPER_ADMIN')
  @ScopeTarget('department', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this department' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({
    status: 409,
    description: 'Department code already in use within this faculty',
  })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('SUPER_ADMIN')
  @ScopeTarget('department', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a department' })
  @ApiResponse({ status: 200, description: 'Department deactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this department' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({
    status: 409,
    description: 'Department still has active programs',
  })
  remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Permanently delete a deactivated department that nothing references (SUPER_ADMIN)',
  })
  @ApiResponse({ status: 204, description: 'Department deleted' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({
    status: 409,
    description: 'Department is still active or still referenced',
  })
  hardDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.departmentService.hardDelete(id, user.userId);
  }
}
