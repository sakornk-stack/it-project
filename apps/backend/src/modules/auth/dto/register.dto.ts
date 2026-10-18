import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'student@example.ac.th' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @ApiProperty({ example: 'Somchai Jaidee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  // studentCode/programId/curriculumId/admissionYear are optional at the
  // DTO level and required-unless-invitationToken-is-present at the
  // service level (same convention as CreateUserDto.scope — the rule
  // depends on another field's value, not just this one's type). When an
  // invitationToken is present, AuthService.register ignores whatever the
  // client sends here and uses the invitation's own stored values instead.
  @ApiPropertyOptional({ example: 'a1b2c3...' })
  @IsOptional()
  @IsString()
  invitationToken?: string;

  @ApiPropertyOptional({ example: '6512345678' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentCode?: string;

  @ApiPropertyOptional({ example: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional({ example: 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d' })
  @IsOptional()
  @IsUUID()
  curriculumId?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  admissionYear?: number;

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
