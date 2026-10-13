import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../auth/request-user.interface';
import { CareerFitReportDto } from './career-fit-report.dto';
import { CareerFitService } from './career-fit.service';

@ApiTags('career-fit')
@Controller('students/me/career-fit')
export class CareerFitController {
  constructor(private readonly careerFitService: CareerFitService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'ความเหมาะสมกับสายอาชีพของนิสิต (เฉพาะของตนเอง) คำนวณจากผลการเรียนและหลักสูตรของนิสิต',
  })
  @ApiResponse({ status: 200, type: CareerFitReportDto })
  @ApiResponse({ status: 404, description: 'ไม่พบข้อมูลนิสิต' })
  getMyCareerFit(@CurrentUser() user: RequestUser) {
    return this.careerFitService.getMyCareerFit(user);
  }
}
