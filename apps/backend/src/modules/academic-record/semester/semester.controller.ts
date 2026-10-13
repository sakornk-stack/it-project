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
import { SemesterService } from './semester.service';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';

@ApiTags('academic-record')
@Controller('semesters')
export class SemesterController {
  constructor(private readonly semesterService: SemesterService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active semesters' })
  @ApiResponse({ status: 200, description: 'List of active semesters' })
  findAll() {
    return this.semesterService.findAll();
  }

  // Registered before `:id` so "inactive" is never read as an id.
  @Get('inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List deactivated semester records (SUPER_ADMIN)' })
  @ApiResponse({ status: 200, description: 'Deactivated semester records' })
  findInactive() {
    return this.semesterService.findInactive();
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore a deactivated semester (SUPER_ADMIN)' })
  @ApiResponse({ status: 201, description: 'Semester reactivated' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  @ApiResponse({
    status: 409,
    description: 'Already active, parent still deactivated, or the key is taken by an active record',
  })
  reactivate(@Param('id') id: string) {
    return this.semesterService.reactivate(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a semester by id' })
  @ApiResponse({ status: 200, description: 'Semester found' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  findOne(@Param('id') id: string) {
    return this.semesterService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a semester' })
  @ApiResponse({ status: 201, description: 'Semester created' })
  @ApiResponse({ status: 404, description: 'Academic year not found or inactive' })
  @ApiResponse({
    status: 409,
    description: 'Semester term already in use within this academic year',
  })
  create(@Body() dto: CreateSemesterDto) {
    return this.semesterService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a semester' })
  @ApiResponse({ status: 200, description: 'Semester updated' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  @ApiResponse({
    status: 409,
    description: 'Semester term already in use within this academic year',
  })
  update(@Param('id') id: string, @Body() dto: UpdateSemesterDto) {
    return this.semesterService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a semester' })
  @ApiResponse({ status: 200, description: 'Semester deactivated' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  @ApiResponse({
    status: 409,
    description: 'Semester still has student course records',
  })
  remove(@Param('id') id: string) {
    return this.semesterService.remove(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Permanently delete a deactivated, unreferenced semester (SUPER_ADMIN)' })
  @ApiResponse({ status: 204, description: 'Semester deleted' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  @ApiResponse({
    status: 409,
    description: 'Semester is still active or still referenced by records/assessments',
  })
  hardDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.semesterService.hardDelete(id, user.userId);
  }
}
