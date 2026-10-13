import { Module } from '@nestjs/common';
import { StudentCourseRecordModule } from '../academic-record/student-course-record/student-course-record.module';
import { StudentProfileModule } from '../users/student-profile/student-profile.module';
import { CareerFitController } from './career-fit.controller';
import { CareerFitService } from './career-fit.service';

@Module({
  imports: [StudentProfileModule, StudentCourseRecordModule],
  controllers: [CareerFitController],
  providers: [CareerFitService],
})
export class CareerFitModule {}
