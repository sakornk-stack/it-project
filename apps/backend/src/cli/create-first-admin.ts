// One-off provisioning of the very first SUPER_ADMIN on a fresh database.
// SUPER_ADMIN cannot be created through the API (user-management.service.ts),
// so this is the deliberate out-of-band path. Run inside the backend image:
//   node apps/backend/dist/cli/create-first-admin.js --email=<address> --name="<full name>" --confirm
//   (or FIRST_ADMIN_EMAIL=... FIRST_ADMIN_NAME=... node ... --confirm)
// (deploy/create-first-admin.sh wraps this for the VPS.)
//
// - Refuses when any SUPER_ADMIN role row already exists, or the email is taken.
// - Writes only users + user_roles(SUPER_ADMIN) + user_auth_methods(PASSWORD),
//   in one transaction. No StudentProfile, no scope.
// - The password hash comes from random bytes that are discarded at once, so
//   nobody knows the password. The admin sets a real one through the normal
//   "forgot password" page, which also proves SMTP works.
// - Output names the account by id and masked email only; never the hash.
import { randomBytes } from 'crypto';
import { AuthProvider, Prisma, PrismaClient, Role } from '@prisma/client';
import { normalizeEmail } from '../common/auth/signup-domain';
import { maskEmail } from '../common/email/email.service';
import { hashPassword } from '../common/util/password.util';

// Arbitrary constant: serialises two concurrent runs so both cannot pass the
// "no SUPER_ADMIN yet" check.
const ADVISORY_LOCK_KEY = 7_412_093_551;
// local@domain.tld; the domain part has no "@" and contains a dot.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 200;

export class FirstAdminRefusedError extends Error {}

export interface FirstAdminInput {
  email: string;
  fullName: string;
}

export interface FirstAdminResult {
  id: string;
  maskedEmail: string;
}

type TransactionRunner = Pick<PrismaClient, '$transaction'>;

export async function createFirstAdmin(
  prisma: TransactionRunner,
  input: FirstAdminInput,
  hash: (plain: string) => Promise<string> = hashPassword,
): Promise<FirstAdminResult> {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new FirstAdminRefusedError('Email address is not valid');
  }
  if (!fullName || fullName.length > MAX_NAME_LENGTH) {
    throw new FirstAdminRefusedError(`Full name must be 1-${MAX_NAME_LENGTH} characters`);
  }

  const passwordHash = await hash(randomBytes(32).toString('base64url'));

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint)`;

    const existingAdmin = await tx.userRole.findFirst({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true },
    });
    if (existingAdmin) {
      throw new FirstAdminRefusedError('A SUPER_ADMIN already exists; nothing was created');
    }

    const existingUser = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser) {
      throw new FirstAdminRefusedError('That email already has an account; nothing was created');
    }

    const user = await tx.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        // Same as admin-created accounts: the hash is unusable anyway.
        mustChangePassword: true,
        userRoles: { create: { role: Role.SUPER_ADMIN } },
        authMethods: { create: { provider: AuthProvider.PASSWORD } },
      },
      select: { id: true },
    });
    return { id: user.id, maskedEmail: maskEmail(email) };
  });
}

function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

// Returns the process exit code. `log` receives every line printed.
// Email and name come from FIRST_ADMIN_EMAIL / FIRST_ADMIN_NAME (what
// deploy/create-first-admin.sh passes, so they never appear in a process
// list) or from --email= / --name= flags.
export async function run(
  argv: string[],
  prisma: TransactionRunner,
  log: (line: string) => void,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const email = readFlag(argv, 'email') ?? env.FIRST_ADMIN_EMAIL;
  const fullName = readFlag(argv, 'name') ?? env.FIRST_ADMIN_NAME;
  if (!email || !fullName) {
    log(
      'Usage: set FIRST_ADMIN_EMAIL and FIRST_ADMIN_NAME (or --email= --name=), then add --confirm',
    );
    return 2;
  }
  if (!argv.includes('--confirm')) {
    log(`Dry run: would create SUPER_ADMIN ${maskEmail(normalizeEmail(email))}. Add --confirm.`);
    return 0;
  }

  try {
    const result = await createFirstAdmin(prisma, { email, fullName });
    log(`Created SUPER_ADMIN ${result.maskedEmail} (id ${result.id}).`);
    log('Next: open the site, choose "forgot password" and enter this email to set a password.');
    return 0;
  } catch (error) {
    if (error instanceof FirstAdminRefusedError) {
      log(`Refused: ${error.message}`);
      return 1;
    }
    // Driver errors can carry connection details; print the class only.
    log(`Failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    return 1;
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  void run(process.argv.slice(2), prisma, (line) => console.log(line))
    .then((code) => {
      process.exitCode = code;
    })
    .finally(() => prisma.$disconnect());
}
