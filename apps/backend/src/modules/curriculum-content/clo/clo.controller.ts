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
import { Roles } from '../../../common/decorators/roles.decorator';
import { ScopeTarget } from '../../../common/decorators/scope-target.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { CloService } from './clo.service';
import { CreateCloDto } from './dto/create-clo.dto';
import { UpdateCloDto } from './dto/update-clo.dto';

@ApiTags('curriculum-content')
@Controller('clos')
export class CloController {
  constructor(private readonly cloService: CloService) {}

  // STAFF/INSTRUCTOR must not view CLO/PLO/CloPloMapping at all
  // (PROJECT_CONTEXT.md §10/§9) — @Roles closes this at the API level,
  // not just by omission in the frontend.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active CLOs' })
  @ApiResponse({ status: 200, description: 'List of active CLOs' })
  findAll() {
    return this.cloService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a CLO by id' })
  @ApiResponse({ status: 200, description: 'CLO found' })
  @ApiResponse({ status: 404, description: 'CLO not found' })
  findOne(@Param('id') id: string) {
    return this.cloService.findOne(id);
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
  create(@Body() dto: CreateCloDto) {
    return this.cloService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('ADMIN')
  @ScopeTarget('clo', { from: 'param', key: 'id' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a CLO' })
  @ApiResponse({ status: 200, description: 'CLO updated' })
  @ApiResponse({ status: 403, description: 'No scope covering this CLO' })
  @ApiResponse({ status: 404, description: 'CLO not found' })
  @ApiResponse({
    status: 409,
    description: 'CLO code already in use within this course',
  })
  update(@Param('id') id: string, @Body() dto: UpdateCloDto) {
    return this.cloService.update(id, dto);
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
    description: 'CLO still has active CLO-PLO mappings',
  })
  remove(@Param('id') id: string) {
    return this.cloService.remove(id);
  }
}
