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
import { PloService } from './plo.service';
import { CreatePloDto } from './dto/create-plo.dto';
import { UpdatePloDto } from './dto/update-plo.dto';

@ApiTags('curriculum-content')
@Controller('plos')
export class PloController {
  constructor(
    private readonly ploService: PloService,
    private readonly catalogScope: CatalogScopeService,
  ) {}

  // STAFF/INSTRUCTOR must not view CLO/PLO/CloPloMapping at all
  // (PROJECT_CONTEXT.md §10/§9) — @Roles closes this at the API level,
  // not just by omission in the frontend. ADMIN/STUDENT then only see their
  // own curricula (see CatalogScopeService).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active PLOs within the caller scope' })
  @ApiResponse({ status: 200, description: 'List of active PLOs' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.ploService.findAllInCurricula(
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a PLO by id within the caller scope' })
  @ApiResponse({ status: 200, description: 'PLO found' })
  @ApiResponse({ status: 404, description: 'PLO not found or outside the caller scope' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.ploService.findOneInCurricula(
      id,
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('curriculum', { from: 'body', key: 'curriculumId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a PLO' })
  @ApiResponse({ status: 201, description: 'PLO created' })
  @ApiResponse({ status: 403, description: 'No scope covering this curriculum' })
  @ApiResponse({ status: 404, description: 'Curriculum not found or inactive' })
  @ApiResponse({
    status: 409,
    description: 'PLO code already in use within this curriculum',
  })
  create(@Body() dto: CreatePloDto) {
    return this.ploService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('plo', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a PLO' })
  @ApiResponse({ status: 200, description: 'PLO updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this PLO' })
  @ApiResponse({ status: 404, description: 'PLO not found' })
  @ApiResponse({
    status: 409,
    description: 'PLO code already in use within this curriculum',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePloDto) {
    return this.ploService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('plo', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a PLO' })
  @ApiResponse({ status: 200, description: 'PLO deactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this PLO' })
  @ApiResponse({ status: 404, description: 'PLO not found' })
  @ApiResponse({
    status: 409,
    description: 'PLO still has active CLO-PLO mappings',
  })
  remove(@Param('id') id: string) {
    return this.ploService.remove(id);
  }
}
