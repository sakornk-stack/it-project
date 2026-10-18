import { ApiProperty } from '@nestjs/swagger';
import { Grade } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CreateStudentCourseRecordDto {
  // Required so a SUPER_ADMIN can create/correct a record on a student's
  // behalf. When the requester is a STUDENT, the service ignores this
  // value and always uses their own resolved studentProfileId instead —
  // see CONVENTIONS.md §3a. The field still has to be present and a valid
  // UUID to pass DTO validation regardless of role.
  @ApiProperty({ example: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  studentProfileId!: string;

  @ApiProperty({ example: 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ example: 'c5f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  semesterId!: string;

  @ApiProperty({ enum: Grade, example: Grade.B_PLUS })
  @IsEnum(Grade)
  grade!: Grade;
}
