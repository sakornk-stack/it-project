import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { CreditCheckerService } from './credit-checker.service';

@ApiTags('academic-record')
@Controller('credit-checker')
export class CreditCheckerController {
  constructor(private readonly creditCheckerService: CreditCheckerService) {}

  @Get(':studentProfileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Smart Credit Checker — degree progress report for a student profile, computed from their own curriculum version',
  })
  @ApiResponse({ status: 200, description: 'Credit check report' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  checkCredits(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.creditCheckerService.checkCredits(studentProfileId, user);
  }
}
