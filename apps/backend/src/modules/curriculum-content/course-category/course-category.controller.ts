import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CatalogScopeService } from '../../../common/scope/catalog-scope.service';
import { RequestUser } from '../../auth/request-user.interface';
import { CourseCategoryService } from './course-category.service';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';

@ApiTags('curriculum-content')
@Controller('course-categories')
export class CourseCategoryController {
  constructor(
    private readonly courseCategoryService: CourseCategoryService,
    private readonly catalogScope: CatalogScopeService,
  ) {}

  // Reads are limited to the caller's curricula; SUPER_ADMIN has no access to
  // academic data (see CatalogScopeService).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active course categories within the caller scope' })
  @ApiResponse({ status: 200, description: 'List of active course categories' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.courseCategoryService.findAllInCurricula(
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a course category by id within the caller scope' })
  @ApiResponse({ status: 200, description: 'Course category found' })
  @ApiResponse({ status: 404, description: 'Course category not found or outside the caller scope' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.courseCategoryService.findOneInCurricula(
      id,
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('curriculum', { from: 'body', key: 'curriculumId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a course category' })
  @ApiResponse({ status: 201, description: 'Course category created' })
  @ApiResponse({ status: 403, description: 'No scope covering this curriculum' })
  @ApiResponse({ status: 404, description: 'Curriculum not found or inactive' })
  @ApiResponse({
    status: 409,
    description: 'Course category name already in use within this curriculum',
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCourseCategoryDto) {
    return this.courseCategoryService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('courseCategory', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a course category' })
  @ApiResponse({ status: 200, description: 'Course category updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this course category' })
  @ApiResponse({ status: 404, description: 'Course category not found' })
  @ApiResponse({
    status: 409,
    description: 'Course category name already in use within this curriculum',
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseCategoryDto,
  ) {
    return this.courseCategoryService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('courseCategory', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a course category' })
  @ApiResponse({ status: 200, description: 'Course category deactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this course category' })
  @ApiResponse({ status: 404, description: 'Course category not found' })
  @ApiResponse({
    status: 409,
    description: 'Course category still has active courses',
  })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.courseCategoryService.remove(id, user);
  }
}
