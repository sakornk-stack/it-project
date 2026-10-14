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
import { ProgramService } from './program.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

@ApiTags('organization')
@Controller('programs')
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  // Public — see FacultyController's findAll for the reasoning.
  @Get()
  @ApiOperation({ summary: 'List active programs' })
  @ApiResponse({ status: 200, description: 'List of active programs' })
  findAll() {
    return this.programService.findAll();
  }

  // Registered before `:id` so "inactive" is never read as an id.
  @Get('inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List deactivated program records (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Deactivated program records' })
  findInactive() {
    return this.programService.findInactive();
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore a deactivated program (SUPER_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Program reactivated' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({
    status: 409,
    description: 'Already active, parent still deactivated, or the key is taken by an active record',
  })
  reactivate(@Param('id') id: string) {
    return this.programService.reactivate(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a program by id' })
  @ApiResponse({ status: 200, description: 'Program found' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  findOne(@Param('id') id: string) {
    return this.programService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('SUPER_ADMIN')
  @ScopeTarget('department', { from: 'body', key: 'departmentId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a program' })
  @ApiResponse({ status: 201, description: 'Program created' })
  @ApiResponse({ status: 403, description: 'No scope covering this department' })
  @ApiResponse({
    status: 404,
    description: 'Department not found or inactive',
  })
  @ApiResponse({
    status: 409,
    description: 'Program name or code already in use within this department',
  })
  create(@Body() dto: CreateProgramDto) {
    return this.programService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('SUPER_ADMIN')
  @ScopeTarget('program', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a program' })
  @ApiResponse({ status: 200, description: 'Program updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this program' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({
    status: 409,
    description: 'Program name or code already in use within this department',
  })
  update(@Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return this.programService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('SUPER_ADMIN')
  @ScopeTarget('program', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a program' })
  @ApiResponse({ status: 200, description: 'Program deactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this program' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({
    status: 409,
    description: 'Program still has active curricula',
  })
  remove(@Param('id') id: string) {
    return this.programService.remove(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Permanently delete a deactivated program that nothing references (SUPER_ADMIN)',
  })
  @ApiResponse({ status: 204, description: 'Program deleted' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({
    status: 409,
    description: 'Program is still active or still referenced',
  })
  hardDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.programService.hardDelete(id, user.userId);
  }
}
