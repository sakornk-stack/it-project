import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateStudentAdvisorDto {
  // An active INSTRUCTOR-role account, or null to clear the advisor.
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  advisorUserId!: string | null;
}
