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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentCourseRecordService } from './student-course-record.service';
import { CreateStudentCourseRecordDto } from './dto/create-student-course-record.dto';
import { UpdateStudentCourseRecordDto } from './dto/update-student-course-record.dto';

@ApiTags('academic-record')
@Controller('student-course-records')
export class StudentCourseRecordController {
  constructor(
    private readonly studentCourseRecordService: StudentCourseRecordService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'List student course records (STUDENT sees only their own; ADMIN/STAFF see students in their scope; SUPER_ADMIN sees all)',
  })
  @ApiResponse({ status: 200, description: 'List of student course records' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.studentCourseRecordService.findAll(user);
  }

  @Get('gpa/:studentProfileId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Calculate GPA for a student profile (deterministic, computed live)',
  })
  @ApiResponse({ status: 200, description: 'GPA calculation result' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  calculateGpa(
    @Param('studentProfileId') studentProfileId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.studentCourseRecordService.calculateGpa(studentProfileId, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'ADMIN', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a student course record by id' })
  @ApiResponse({ status: 200, description: 'Student course record found' })
  @ApiResponse({ status: 404, description: 'Student course record not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.studentCourseRecordService.findOne(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a student course record' })
  @ApiResponse({ status: 201, description: 'Student course record created' })
  @ApiResponse({ status: 404, description: 'Student profile, course, or semester not found or inactive' })
  @ApiResponse({ status: 409, description: 'A record for this course/semester already exists' })
  create(
    @Body() dto: CreateStudentCourseRecordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.studentCourseRecordService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'STAFF', 'INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a student course record (grade only)' })
  @ApiResponse({ status: 200, description: 'Student course record updated' })
  @ApiResponse({ status: 404, description: 'Student course record not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentCourseRecordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.studentCourseRecordService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT', 'STAFF', 'INSTRUCTOR')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a student course record' })
  @ApiResponse({ status: 200, description: 'Student course record deleted' })
  @ApiResponse({ status: 404, description: 'Student course record not found' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.studentCourseRecordService.remove(id, user);
  }
}
