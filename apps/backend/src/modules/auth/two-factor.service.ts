import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import * as qrcode from 'qrcode';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryCodeFormat,
} from '../../common/util/crypto.util';

const RECOVERY_CODE_COUNT = 8;
const TOTP_CODE_FORMAT = /^\d{6}$/;
const ISSUER = 'EduAnalyzeAI';
export const TWO_FACTOR_ALREADY_ENABLED_MESSAGE =
  'เปิดใช้งานการยืนยันตัวตนสองขั้นตอนอยู่แล้ว กรุณาปิดก่อน (ต้องยืนยันรหัสผ่าน) จึงจะตั้งค่าใหม่ได้';

// Authenticator-app (TOTP) 2FA — opt-in, separate from grade-based
// calculation/self-assessment/evidence modules entirely; this is pure
// auth infrastructure. See schema.prisma's comment on TwoFactorCredential
// for the full design rationale (encryption, recovery, why it's not a
// reintroduction of the removed email-OTP design).
//
// Deliberately its own service, not folded into AuthService — AuthService
// owns login/token-issuance; this owns TwoFactorCredential CRUD and code
// verification. AuthService.login()/handleGoogleCallback() call
// isEnabled()/verifyLoginCode() as the two touch points between them.
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async isEnabled(userId: string): Promise<boolean> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    return credential?.enabled ?? false;
  }

  // Generates a fresh secret and stores it as a pending (enabled:false)
  // credential — calling this again before enable() just overwrites the
  // pending secret, harmless. Refused once 2FA is enabled: replacing an
  // active credential needs disable() first (password-gated), otherwise a
  // stolen bearer token could silently switch 2FA off. Nothing takes effect until enable() proves
  // the user can actually generate a valid code with it (prevents locking
  // yourself out with a mistyped/never-scanned secret).
  async setup(userId: string, email: string): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const existing = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    if (existing?.enabled) {
      throw new ConflictException(TWO_FACTOR_ALREADY_ENABLED_MESSAGE);
    }

    const secret = generateSecret();
    const secretCiphertext = encryptSecret(secret, this.encryptionKey());

    await this.prisma.twoFactorCredential.upsert({
      where: { userId },
      create: { userId, secretCiphertext, enabled: false, recoveryCodeHashes: [] },
      // Only reached for a pending (never-enabled) credential.
      update: { secretCiphertext, enabled: false, recoveryCodeHashes: [] },
    });

    const otpauthUrl = generateURI({ issuer: ISSUER, label: email, secret });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    return { qrCodeDataUrl, secret };
  }

  // First real proof the user's authenticator app is correctly set up —
  // flips enabled:true and issues recovery codes (shown to the caller
  // exactly once, same "no way to retrieve later" pattern the old
  // TempPasswordReveal used for temp passwords).
  async enable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    if (!credential) {
      throw new BadRequestException('Call POST /auth/2fa/setup first');
    }

    if (!(await this.isValidTotp(credential.secretCiphertext, code))) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    await this.prisma.twoFactorCredential.update({
      where: { userId },
      data: {
        enabled: true,
        recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
      },
    });

    return { recoveryCodes };
  }

  // Reauth-gated with a live TOTP code (not password, unlike disable()) —
  // replaces recoveryCodeHashes wholesale, so any old codes (including
  // ones that may have leaked) stop working the instant this succeeds.
  // Returns the new set plaintext, same one-time-reveal contract as
  // enable().
  async regenerateRecoveryCodes(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    if (!credential || !credential.enabled) {
      throw new BadRequestException('2FA is not enabled on this account');
    }

    if (!(await this.isValidTotp(credential.secretCiphertext, code))) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    await this.prisma.twoFactorCredential.update({
      where: { userId },
      data: { recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode) },
    });

    return { recoveryCodes };
  }

  // Reauth-gated (mirrors AuthService.changePassword's bcrypt.compare
  // pattern exactly) — deletes the credential row entirely, not a soft
  // disable. No audit/natural-key requirement to keep it around.
  async disable(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.twoFactorCredential.deleteMany({ where: { userId } });
  }

  // Used by the POST /auth/2fa/verify login step-up. Tries a recovery
  // code first (cheap shape check via isRecoveryCodeFormat before any
  // hashing/decryption), falls back to a live TOTP code otherwise. A
  // matched recovery code is consumed (removed from the array) — single
  // use, same as PasswordResetToken.
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const credential = await this.prisma.twoFactorCredential.findUnique({ where: { userId } });
    if (!credential || !credential.enabled) {
      return false;
    }

    if (isRecoveryCodeFormat(code)) {
      const hash = hashRecoveryCode(code);
      if (!credential.recoveryCodeHashes.includes(hash)) {
        return false;
      }
      await this.prisma.twoFactorCredential.update({
        where: { userId },
        data: {
          recoveryCodeHashes: credential.recoveryCodeHashes.filter((h) => h !== hash),
        },
      });
      return true;
    }

    return this.isValidTotp(credential.secretCiphertext, code);
  }

  // The one place a TOTP code is checked. otplib throws (not returns false) on
  // anything but exactly 6 digits, which would surface as a 500; a malformed
  // code is just a wrong code, so it is answered like one, before decrypting.
  private async isValidTotp(secretCiphertext: string, code: string): Promise<boolean> {
    if (!TOTP_CODE_FORMAT.test(code)) {
      return false;
    }
    const secret = decryptSecret(secretCiphertext, this.encryptionKey());
    const result = await verifyTotp({ token: code, secret });
    return result.valid;
  }

  private encryptionKey(): string {
    const key = this.configService.get<string>('totp.encryptionKey');
    if (!key) {
      throw new Error('TOTP_ENCRYPTION_KEY is not configured');
    }
    return key;
  }
}
