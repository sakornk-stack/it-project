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

export class CreateCloDto {
  @ApiProperty({ example: 'CLO1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'สามารถเขียนโปรแกรมเชิงโครงสร้างแก้ปัญหาพื้นฐานได้' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    example: 70,
    minimum: 0,
    maximum: 100,
    description:
      'Overrides Curriculum.defaultAchievementThreshold for this CLO. Omit to use the curriculum default.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  achievementThreshold?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'false marks a CLO copied from another curriculum year that ADMIN has not checked.',
  })
  @IsOptional()
  @IsBoolean()
  isConfirmed?: boolean;

  @ApiProperty({ example: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  courseId!: string;
}
