import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../auth/request-user.interface';
import { AdvisorService } from './advisor.service';

// No ScopeGuard: the scope here is the advisor link itself, applied as a
// query filter in AdvisorService (an unrelated student is a 404).
@ApiTags('advisor')
@Controller('advisor/students')
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Students the caller advises, with GPA and credit progress (read-only)',
  })
  @ApiResponse({ status: 200, description: 'Advisees, by student code' })
  listAdvisees(@CurrentUser() user: RequestUser) {
    return this.advisorService.listAdvisees(user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'One advisee: GPA by term, course records, credit check and PLO achievement — the same figures the student sees (read-only)',
  })
  @ApiResponse({ status: 200, description: 'Advisee detail' })
  @ApiResponse({ status: 404, description: 'Not a student the caller advises' })
  getAdvisee(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.advisorService.getAdvisee(id, user);
  }
}
