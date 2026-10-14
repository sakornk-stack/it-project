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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { FacultyService } from './faculty.service';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';

@ApiTags('organization')
@Controller('faculties')
export class FacultyController {
  constructor(private readonly facultyService: FacultyService) {}

  // Public — university org structure (faculty/department/program/
  // curriculum catalog) is publicly-knowable information in the real
  // world, and Register needs it before the user has an account at all.
  @Get()
  @ApiOperation({ summary: 'List active faculties' })
  @ApiResponse({ status: 200, description: 'List of active faculties' })
  findAll() {
    return this.facultyService.findAll();
  }

  // Registered before `:id` so "inactive" is never read as an id.
  @Get('inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List deactivated faculty records (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Deactivated faculty records' })
  findInactive() {
    return this.facultyService.findInactive();
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore a deactivated faculty (SUPER_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Faculty reactivated' })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  @ApiResponse({
    status: 409,
    description: 'Already active, parent still deactivated, or the key is taken by an active record',
  })
  reactivate(@Param('id') id: string) {
    return this.facultyService.reactivate(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a faculty by id' })
  @ApiResponse({ status: 200, description: 'Faculty found' })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  findOne(@Param('id') id: string) {
    return this.facultyService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a faculty' })
  @ApiResponse({ status: 201, description: 'Faculty created' })
  @ApiResponse({ status: 409, description: 'Faculty code already in use' })
  create(@Body() dto: CreateFacultyDto) {
    return this.facultyService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a faculty' })
  @ApiResponse({ status: 200, description: 'Faculty updated' })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  @ApiResponse({ status: 409, description: 'Faculty code already in use' })
  update(@Param('id') id: string, @Body() dto: UpdateFacultyDto) {
    return this.facultyService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a faculty' })
  @ApiResponse({ status: 200, description: 'Faculty deactivated' })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  @ApiResponse({
    status: 409,
    description: 'Faculty still has active departments',
  })
  remove(@Param('id') id: string) {
    return this.facultyService.remove(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Permanently delete a deactivated faculty that nothing references (SUPER_ADMIN)',
  })
  @ApiResponse({ status: 204, description: 'Faculty deleted' })
  @ApiResponse({ status: 404, description: 'Faculty not found' })
  @ApiResponse({
    status: 409,
    description: 'Faculty is still active or still referenced',
  })
  hardDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.facultyService.hardDelete(id, user.userId);
  }
}
