import { ApiProperty } from '@nestjs/swagger';
import { Grade } from '@prisma/client';
import { IsIn } from 'class-validator';
import { ENTRY_GRADE_MESSAGE, ENTRY_GRADES } from '../grade-point.constant';

// Only grade is updatable — studentProfileId/courseId/semesterId identify
// the row itself (delete + recreate to change any of those), matching the
// UpdatePrerequisiteDto/UpdateCloPloMappingDto pattern.
export class UpdateStudentCourseRecordDto {
  @ApiProperty({ enum: ENTRY_GRADES, example: Grade.A })
  @IsIn(ENTRY_GRADES, { message: ENTRY_GRADE_MESSAGE })
  grade!: Grade;
}
