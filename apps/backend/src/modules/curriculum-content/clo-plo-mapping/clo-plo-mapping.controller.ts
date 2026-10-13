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
import { CloPloMappingService } from './clo-plo-mapping.service';
import { CreateCloPloMappingDto } from './dto/create-clo-plo-mapping.dto';
import { UpdateCloPloMappingDto } from './dto/update-clo-plo-mapping.dto';

@ApiTags('curriculum-content')
@Controller('clo-plo-mappings')
export class CloPloMappingController {
  constructor(private readonly cloPloMappingService: CloPloMappingService) {}

  // STAFF/INSTRUCTOR must not view CLO/PLO/CloPloMapping at all
  // (PROJECT_CONTEXT.md §10/§9) — @Roles closes this at the API level,
  // not just by omission in the frontend.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active CLO-PLO mappings' })
  @ApiResponse({ status: 200, description: 'List of active CLO-PLO mappings' })
  findAll() {
    return this.cloPloMappingService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a CLO-PLO mapping by id' })
  @ApiResponse({ status: 200, description: 'CLO-PLO mapping found' })
  @ApiResponse({ status: 404, description: 'CLO-PLO mapping not found' })
  findOne(@Param('id') id: string) {
    return this.cloPloMappingService.findOne(id);
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
  create(@Body() dto: CreateCloPloMappingDto) {
    return this.cloPloMappingService.create(dto);
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
  update(@Param('id') id: string, @Body() dto: UpdateCloPloMappingDto) {
    return this.cloPloMappingService.update(id, dto);
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
  remove(@Param('id') id: string) {
    return this.cloPloMappingService.remove(id);
  }
}
