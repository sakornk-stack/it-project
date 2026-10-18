import { Module } from '@nestjs/common';
import { CourseModule } from '../../curriculum-content/course/course.module';
import { StudentProfileModule } from '../../users/student-profile/student-profile.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { SemesterModule } from '../semester/semester.module';
import { CourseStudentsController } from './course-students.controller';
import { StudentCourseRecordController } from './student-course-record.controller';
import { StudentCourseRecordService } from './student-course-record.service';

@Module({
  imports: [StudentProfileModule, CourseModule, SemesterModule, ScopeModule, AuditLogModule],
  controllers: [StudentCourseRecordController, CourseStudentsController],
  providers: [StudentCourseRecordService],
  exports: [StudentCourseRecordService],
})
export class StudentCourseRecordModule {}
