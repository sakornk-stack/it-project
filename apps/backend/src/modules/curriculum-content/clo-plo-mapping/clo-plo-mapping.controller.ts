import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
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
import { CloPloMappingService } from './clo-plo-mapping.service';
import { CreateCloPloMappingDto } from './dto/create-clo-plo-mapping.dto';
import { UpdateCloPloMappingDto } from './dto/update-clo-plo-mapping.dto';

@ApiTags('curriculum-content')
@Controller('clo-plo-mappings')
export class CloPloMappingController {
  constructor(
    private readonly cloPloMappingService: CloPloMappingService,
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
  @ApiOperation({ summary: 'List active CLO-PLO mappings within the caller scope' })
  @ApiResponse({ status: 200, description: 'List of active CLO-PLO mappings' })
  @ApiQuery({ name: 'curriculumId', required: false })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('curriculumId', new ParseUUIDPipe({ optional: true })) curriculumId?: string,
  ) {
    return this.cloPloMappingService.findAllInCurricula(
      await this.catalogScope.curriculumWhere(user),
      curriculumId,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a CLO-PLO mapping by id within the caller scope' })
  @ApiResponse({ status: 200, description: 'CLO-PLO mapping found' })
  @ApiResponse({ status: 404, description: 'CLO-PLO mapping not found or outside the caller scope' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.cloPloMappingService.findOneInCurricula(
      id,
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('plo', { from: 'body', key: 'ploId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a CLO-PLO mapping' })
  @ApiResponse({ status: 201, description: 'CLO-PLO mapping created' })
  @ApiResponse({ status: 400, description: 'CLO and PLO do not belong to the same curriculum' })
  @ApiResponse({ status: 403, description: 'No scope covering this PLO' })
  @ApiResponse({ status: 404, description: 'CLO or PLO not found or inactive' })
  @ApiResponse({ status: 409, description: 'CLO-PLO mapping already exists' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCloPloMappingDto) {
    return this.cloPloMappingService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('cloPloMapping', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a CLO-PLO mapping (weight only)' })
  @ApiResponse({ status: 200, description: 'CLO-PLO mapping updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this CLO-PLO mapping' })
  @ApiResponse({ status: 404, description: 'CLO-PLO mapping not found' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCloPloMappingDto,
  ) {
    return this.cloPloMappingService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('cloPloMapping', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a CLO-PLO mapping' })
  @ApiResponse({ status: 200, description: 'CLO-PLO mapping deactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this CLO-PLO mapping' })
  @ApiResponse({ status: 404, description: 'CLO-PLO mapping not found' })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.cloPloMappingService.remove(id, user);
  }
}
