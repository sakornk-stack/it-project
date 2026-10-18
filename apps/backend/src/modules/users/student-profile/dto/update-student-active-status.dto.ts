import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateStudentActiveStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive!: boolean;

  // Kept in the audit log; the service also refuses one that is only spaces.
  @ApiProperty({ example: 'ลาออกตามคำร้องเลขที่ 12/2569', minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
