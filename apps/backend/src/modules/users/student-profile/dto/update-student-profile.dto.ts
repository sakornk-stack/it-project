import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// studentCode is deliberately absent: it identifies the student and is never
// edited, so the global ValidationPipe (forbidNonWhitelisted) answers 400 when
// a client sends it. userId is absent for the same reason.
export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ example: '6f1c…', description: 'Must be inside your scope too' })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({ example: '9a2e…', description: 'Must belong to the (new) program' })
  @IsOptional()
  @IsUUID()
  curriculumId?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  admissionYear?: number;

  @ApiProperty({ example: 'แก้ปีเข้าที่กรอกผิดตอนเชิญ', minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
