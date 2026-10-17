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
import { CurriculumRequirementService } from './curriculum-requirement.service';
import { CreateCurriculumRequirementDto } from './dto/create-curriculum-requirement.dto';
import { UpdateCurriculumRequirementDto } from './dto/update-curriculum-requirement.dto';

@ApiTags('curriculum-content')
@Controller('curriculum-requirements')
export class CurriculumRequirementController {
  constructor(
    private readonly curriculumRequirementService: CurriculumRequirementService,
    private readonly catalogScope: CatalogScopeService,
  ) {}

  // Reads are limited to the caller's curricula; SUPER_ADMIN has no access to
  // academic data (see CatalogScopeService).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List curriculum requirements within the caller scope' })
  @ApiResponse({ status: 200, description: 'List of curriculum requirements' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.curriculumRequirementService.findAllInCurricula(
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'INSTRUCTOR', 'STAFF', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a curriculum requirement by id within the caller scope' })
  @ApiResponse({ status: 200, description: 'Curriculum requirement found' })
  @ApiResponse({ status: 404, description: 'Curriculum requirement not found or outside the caller scope' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.curriculumRequirementService.findOneInCurricula(
      id,
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('curriculum', { from: 'body', key: 'curriculumId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a curriculum requirement' })
  @ApiResponse({ status: 201, description: 'Curriculum requirement created' })
  @ApiResponse({ status: 403, description: 'No scope covering this curriculum' })
  @ApiResponse({
    status: 404,
    description: 'Curriculum or course category not found or inactive',
  })
  @ApiResponse({
    status: 409,
    description: 'Course category already has a curriculum requirement',
  })
  create(@Body() dto: CreateCurriculumRequirementDto) {
    return this.curriculumRequirementService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('curriculumRequirement', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a curriculum requirement' })
  @ApiResponse({ status: 200, description: 'Curriculum requirement updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this curriculum requirement' })
  @ApiResponse({ status: 404, description: 'Curriculum requirement not found' })
  @ApiResponse({
    status: 409,
    description: 'Course category already has a curriculum requirement',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCurriculumRequirementDto,
  ) {
    return this.curriculumRequirementService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('curriculumRequirement', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a curriculum requirement' })
  @ApiResponse({ status: 200, description: 'Curriculum requirement deleted' })
  @ApiResponse({ status: 403, description: 'No scope covering this curriculum requirement' })
  @ApiResponse({ status: 404, description: 'Curriculum requirement not found' })
  remove(@Param('id') id: string) {
    return this.curriculumRequirementService.remove(id);
  }
}
