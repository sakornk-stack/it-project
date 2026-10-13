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
import { RequestUser } from '../../auth/request-user.interface';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AcademicYearService } from './academic-year.service';
import { BulkCreateAcademicYearsDto } from './dto/bulk-create-academic-years.dto';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@ApiTags('academic-record')
@Controller('academic-years')
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active academic years' })
  @ApiResponse({ status: 200, description: 'List of active academic years' })
  findAll() {
    return this.academicYearService.findAll();
  }

  // Registered before `:id` so "inactive" is never read as an id.
  @Get('inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List deactivated academic year records (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Deactivated academic year records' })
  findInactive() {
    return this.academicYearService.findInactive();
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore a deactivated academic year (SUPER_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Academic year reactivated' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  @ApiResponse({
    status: 409,
    description: 'Already active, parent still deactivated, or the key is taken by an active record',
  })
  reactivate(@Param('id') id: string) {
    return this.academicYearService.reactivate(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get an academic year by id' })
  @ApiResponse({ status: 200, description: 'Academic year found' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  findOne(@Param('id') id: string) {
    return this.academicYearService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an academic year' })
  @ApiResponse({ status: 201, description: 'Academic year created' })
  @ApiResponse({ status: 409, description: 'Academic year already exists' })
  create(@Body() dto: CreateAcademicYearDto) {
    return this.academicYearService.create(dto);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Create a run of consecutive academic years and their terms atomically; existing years/terms are skipped',
  })
  @ApiResponse({ status: 201, description: 'Per-year and per-term created/skipped status' })
  @ApiResponse({ status: 400, description: 'Invalid range (last year above 2700) or body' })
  @ApiResponse({ status: 409, description: 'Concurrent duplicate — nothing saved' })
  bulkCreate(@Body() dto: BulkCreateAcademicYearsDto) {
    return this.academicYearService.bulkCreate(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an academic year' })
  @ApiResponse({ status: 200, description: 'Academic year updated' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  @ApiResponse({ status: 409, description: 'Academic year already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateAcademicYearDto) {
    return this.academicYearService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete an academic year' })
  @ApiResponse({ status: 200, description: 'Academic year deactivated' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  @ApiResponse({
    status: 409,
    description: 'Academic year still has active semesters',
  })
  remove(@Param('id') id: string) {
    return this.academicYearService.remove(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Permanently delete a deactivated academic year and its semesters when nothing references them (SUPER_ADMIN)',
  })
  @ApiResponse({ status: 204, description: 'Academic year deleted' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  @ApiResponse({
    status: 409,
    description: 'Year is still active, has active semesters, or is still referenced',
  })
  hardDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.academicYearService.hardDelete(id, user.userId);
  }
}
