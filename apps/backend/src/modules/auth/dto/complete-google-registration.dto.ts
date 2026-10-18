import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsInt, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CompleteGoogleRegistrationDto {
  @ApiProperty({ example: 'a1b2c3...' })
  @IsString()
  @IsNotEmpty()
  pendingToken!: string;

  @ApiProperty({ example: '6512345678' })
  @IsString()
  @IsNotEmpty()
  studentCode!: string;

  @ApiProperty({ example: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  programId!: string;

  @ApiProperty({ example: 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsUUID()
  curriculumId!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  admissionYear!: number;

  // PDPA consent: the box must be ticked (exactly true) and the version must
  // match PRIVACY_POLICY_VERSION, checked in AuthService before any write.
  @ApiProperty({ example: true })
  @Equals(true, { message: 'acceptPrivacyPolicy must be true' })
  acceptPrivacyPolicy!: true;

  @ApiProperty({ example: '2026-10-18-draft.1' })
  @IsString()
  @IsNotEmpty()
  privacyPolicyVersion!: string;
}
