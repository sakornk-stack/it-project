import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ScopeTarget } from '../../../common/decorators/scope-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { CatalogScopeService } from '../../../common/scope/catalog-scope.service';
import { RequestUser } from '../../auth/request-user.interface';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('curriculum-content')
@Controller('courses')
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly catalogScope: CatalogScopeService,
  ) {}

  // Reads are limited to the caller's curricula; SUPER_ADMIN has no access to
  // academic data (see CatalogScopeService).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active courses within the caller scope' })
  @ApiResponse({ status: 200, description: 'List of active courses' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.courseService.findAllInCurricula(
      await this.catalogScope.curriculumWhere(user),
    );
  }

  // Declared before ':id' so "inactive" is not taken for a course id. STAFF only:
  // the list exists to reactivate from, and reactivating is a STAFF write.
  @Get('inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List deactivated courses within the caller scope (STAFF)' })
  @ApiQuery({ name: 'curriculumId', required: false })
  @ApiResponse({ status: 200, description: 'List of deactivated courses' })
  async findInactive(
    @CurrentUser() user: RequestUser,
    @Query('curriculumId', new ParseUUIDPipe({ optional: true })) curriculumId?: string,
  ) {
    return this.courseService.findInactiveInCurricula(
      await this.catalogScope.curriculumWhere(user),
      curriculumId,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a course by id within the caller scope' })
  @ApiResponse({ status: 200, description: 'Course found' })
  @ApiResponse({ status: 404, description: 'Course not found or outside the caller scope' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.courseService.findOneInCurricula(
      id,
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('curriculum', { from: 'body', key: 'curriculumId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a course' })
  @ApiResponse({ status: 201, description: 'Course created' })
  @ApiResponse({ status: 403, description: 'No scope covering this curriculum' })
  @ApiResponse({
    status: 404,
    description: 'Curriculum or course category not found or inactive',
  })
  @ApiResponse({
    status: 409,
    description: 'Course code already in use within this curriculum',
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCourseDto) {
    return this.courseService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('course', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a course' })
  @ApiResponse({ status: 200, description: 'Course updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this course' })
  @ApiResponse({ status: 404, description: 'Course not found or deactivated' })
  @ApiResponse({
    status: 409,
    description: 'Course code already in use within this curriculum',
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courseService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('course', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a course' })
  @ApiResponse({ status: 200, description: 'Course deactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this course' })
  @ApiResponse({ status: 404, description: 'Course not found or already deactivated' })
  @ApiResponse({
    status: 409,
    description:
      'Course is a prerequisite of another course, or still has student records, instructors, CLOs, assessments, study plans or career links',
  })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.courseService.remove(id, user);
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('course', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Restore a deactivated course (STAFF)' })
  @ApiResponse({ status: 201, description: 'Course reactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this course' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({
    status: 409,
    description:
      'Already active, its curriculum or category is deactivated, or the code is taken by an active course',
  })
  reactivate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.courseService.reactivate(id, user);
  }
}
