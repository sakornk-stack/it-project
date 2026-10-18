import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendEmailSignupDto {
  @ApiProperty({ example: 'student@ku.th' })
  @IsEmail()
  email!: string;
}
