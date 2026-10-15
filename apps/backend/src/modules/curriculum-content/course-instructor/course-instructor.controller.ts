import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
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
import { RequestUser } from '../../auth/request-user.interface';
import { CourseInstructorService } from './course-instructor.service';
import { CreateCourseInstructorDto } from './dto/create-course-instructor.dto';

@ApiTags('curriculum-content')
@Controller('course-instructors')
export class CourseInstructorController {
  constructor(
    private readonly courseInstructorService: CourseInstructorService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List course-instructor assignments within the caller scope, optionally filtered by course' })
  @ApiResponse({ status: 200, description: 'List of assignments' })
  findAll(@CurrentUser() user: RequestUser, @Query('courseId') courseId?: string) {
    return this.courseInstructorService.findAll(user, courseId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
  @Roles('STAFF')
  @ScopeTarget('course', { from: 'body', key: 'courseId' })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign an instructor to a course' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  @ApiResponse({ status: 400, description: 'User does not have the INSTRUCTOR role' })
  @ApiResponse({ status: 403, description: 'No scope covering this course' })
  @ApiResponse({ status: 404, description: 'User or course not found' })
  @ApiResponse({ status: 409, description: 'Assignment already exists' })
  create(@Body() dto: CreateCourseInstructorDto) {
    return this.courseInstructorService.create(dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STAFF')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove an instructor from a course' })
  @ApiResponse({ status: 200, description: 'Assignment removed' })
  @ApiResponse({ status: 403, description: 'No scope covering this course' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.courseInstructorService.remove(id, user);
  }
}
