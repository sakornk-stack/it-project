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
import { PrerequisiteService } from './prerequisite.service';
import { CreatePrerequisiteDto } from './dto/create-prerequisite.dto';
import { UpdatePrerequisiteDto } from './dto/update-prerequisite.dto';

@ApiTags('curriculum-content')
@Controller('prerequisites')
export class PrerequisiteController {
  constructor(
    private readonly prerequisiteService: PrerequisiteService,
    private readonly catalogScope: CatalogScopeService,
  ) {}

  // Reads are limited to the caller's curricula; SUPER_ADMIN has no access to
  // academic data (see CatalogScopeService).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List prerequisites within the caller scope' })
  @ApiResponse({ status: 200, description: 'List of prerequisites' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.prerequisiteService.findAllInCurricula(
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a prerequisite by id within the caller scope' })
  @ApiResponse({ status: 200, description: 'Prerequisite found' })
  @ApiResponse({ status: 404, description: 'Prerequisite not found or outside the caller scope' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prerequisiteService.findOneInCurricula(
      id,
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('course', { from: 'body', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a prerequisite' })
  @ApiResponse({ status: 201, description: 'Prerequisite created' })
  @ApiResponse({ status: 400, description: 'Invalid or cross-curriculum course pair' })
  @ApiResponse({ status: 403, description: 'No scope covering this course' })
  @ApiResponse({ status: 404, description: 'Course not found or inactive' })
  @ApiResponse({ status: 409, description: 'Prerequisite already exists' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePrerequisiteDto) {
    return this.prerequisiteService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('prerequisite', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a prerequisite (groupId only)' })
  @ApiResponse({ status: 200, description: 'Prerequisite updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this prerequisite' })
  @ApiResponse({ status: 404, description: 'Prerequisite not found' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePrerequisiteDto,
  ) {
    return this.prerequisiteService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('prerequisite', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a prerequisite' })
  @ApiResponse({ status: 200, description: 'Prerequisite deleted' })
  @ApiResponse({ status: 403, description: 'No scope covering this prerequisite' })
  @ApiResponse({ status: 404, description: 'Prerequisite not found' })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prerequisiteService.remove(id, user);
  }
}
