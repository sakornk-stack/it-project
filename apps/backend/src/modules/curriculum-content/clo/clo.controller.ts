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
import { CloService } from './clo.service';
import { CreateCloDto } from './dto/create-clo.dto';
import { UpdateCloDto } from './dto/update-clo.dto';

@ApiTags('curriculum-content')
@Controller('clos')
export class CloController {
  constructor(
    private readonly cloService: CloService,
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
  @ApiOperation({ summary: 'List active CLOs within the caller scope' })
  @ApiResponse({ status: 200, description: 'List of active CLOs' })
  @ApiQuery({ name: 'courseId', required: false })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('courseId', new ParseUUIDPipe({ optional: true })) courseId?: string,
  ) {
    return this.cloService.findAllInCurricula(
      await this.catalogScope.curriculumWhere(user),
      courseId,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a CLO by id within the caller scope' })
  @ApiResponse({ status: 200, description: 'CLO found' })
  @ApiResponse({ status: 404, description: 'CLO not found or outside the caller scope' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.cloService.findOneInCurricula(
      id,
      await this.catalogScope.curriculumWhere(user),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('course', { from: 'body', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a CLO' })
  @ApiResponse({ status: 201, description: 'CLO created' })
  @ApiResponse({ status: 403, description: 'No scope covering this course' })
  @ApiResponse({ status: 404, description: 'Course not found or inactive' })
  @ApiResponse({
    status: 409,
    description: 'CLO code already in use within this course',
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCloDto) {
    return this.cloService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('clo', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a CLO' })
  @ApiResponse({ status: 200, description: 'CLO updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this CLO' })
  @ApiResponse({ status: 404, description: 'CLO not found or deactivated' })
  @ApiResponse({
    status: 409,
    description: 'CLO code already in use within this course',
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCloDto,
  ) {
    return this.cloService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('clo', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete a CLO' })
  @ApiResponse({ status: 200, description: 'CLO deactivated' })
  @ApiResponse({ status: 403, description: 'No scope covering this CLO' })
  @ApiResponse({ status: 404, description: 'CLO not found' })
  @ApiResponse({
    status: 409,
    description: 'CLO still has active CLO-PLO mappings or assessment scores',
  })
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.cloService.remove(id, user);
  }
}
