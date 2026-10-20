import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Whole credits per course; 12 covers the largest single courses (co-op, thesis).
export const MIN_COURSE_CREDITS = 0;
export const MAX_COURSE_CREDITS = 12;

export class CreateCourseDto {
  @ApiProperty({ example: 'CS101' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'หลักการเขียนโปรแกรม' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'Principles of Programming' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  @ApiProperty({ example: 3, minimum: MIN_COURSE_CREDITS, maximum: MAX_COURSE_CREDITS })
  @IsInt()
  @Min(MIN_COURSE_CREDITS)
  @Max(MAX_COURSE_CREDITS)
  credits!: number;

  @ApiPropertyOptional({ example: 'Fundamentals of programming using Python' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ example: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  curriculumId!: string;

  @ApiProperty({ example: 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  categoryId!: string;
}
