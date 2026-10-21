import { randomBytes, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';

export const PASSWORD_SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_SALT_ROUNDS);
}

// Hash of a random value nobody knows, made once per process with the same
// cost as real hashes, so comparing against it takes as long as a real check.
let dummyHash: Promise<string> | undefined;

// Spends one bcrypt compare's worth of time and always fails. Login calls it
// on every path that has no real hash to check (unknown email, Google-only
// account, locked account), so the response time does not tell which case it
// was, or whether the email has an account at all.
export async function burnPasswordCompare(plain: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  await bcrypt.compare(plain, await dummyHash);
}

const TEMP_PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

// Server-generated temp password for Module 12's admin-creates-user flow
// (no email service to send a self-service invite link through). Built to
// satisfy the same complexity rule enforced everywhere else (passwordSchema/
// ChangePasswordDto: 8+ chars, at least one lowercase/uppercase/digit) so
// it behaves like any password a user could later choose via
// PATCH /auth/change-password.
export function generateTempPassword(): string {
  const random = Array.from({ length: 9 }, () =>
    TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)],
  ).join('');
  // Guarantees at least one of each required character class regardless
  // of what the random draw produced, without weakening the rest.
  return `Aa1${random}`;
}
