import { ApiProperty } from '@nestjs/swagger';
import { Grade } from '@prisma/client';
import { IsEnum } from 'class-validator';

// Only grade is updatable — studentProfileId/courseId/semesterId identify
// the row itself (delete + recreate to change any of those), matching the
// UpdatePrerequisiteDto/UpdateCloPloMappingDto pattern.
export class UpdateStudentCourseRecordDto {
  @ApiProperty({ enum: Grade, example: Grade.A })
  @IsEnum(Grade)
  grade!: Grade;
}
