import { createFirstAdmin, FirstAdminRefusedError, run } from './create-first-admin';

const FAKE_HASH = '$2a$10$fakehashfakehashfakehashfakehashfakehashfakehashfake';

function setup({
  existingAdmin = null,
  existingUser = null,
}: { existingAdmin?: { id: string } | null; existingUser?: { id: string } | null } = {}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    userRole: { findFirst: jest.fn().mockResolvedValue(existingAdmin) },
    user: {
      findFirst: jest.fn().mockResolvedValue(existingUser),
      create: jest.fn().mockResolvedValue({ id: 'new-admin-id' }),
    },
    studentProfile: { create: jest.fn() },
    userScope: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma: prisma as never };
}

const input = { email: '  Admin.Person@Uni.AC.TH ', fullName: ' Admin Person ' };

describe('createFirstAdmin', () => {
  it('creates only the user, its SUPER_ADMIN role and a PASSWORD method in one transaction', async () => {
    const { tx, prisma } = setup();
    const hash = jest.fn().mockResolvedValue(FAKE_HASH);

    const result = await createFirstAdmin(prisma, input, hash);

    expect(result).toEqual({ id: 'new-admin-id', maskedEmail: 'a***@uni.ac.th' });
    expect((prisma as { $transaction: jest.Mock }).$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: 'admin.person@uni.ac.th',
        fullName: 'Admin Person',
        passwordHash: FAKE_HASH,
        mustChangePassword: true,
        userRoles: { create: { role: 'SUPER_ADMIN' } },
        authMethods: { create: { provider: 'PASSWORD' } },
      },
      select: { id: true },
    });
    expect(tx.studentProfile.create).not.toHaveBeenCalled();
    expect(tx.userScope.create).not.toHaveBeenCalled();
  });

  it('hashes a long random password that is never returned', async () => {
    const { prisma } = setup();
    const hash = jest.fn().mockResolvedValue(FAKE_HASH);

    const first = await createFirstAdmin(prisma, input, hash);
    await createFirstAdmin(setup().prisma, input, hash);

    const [plainA, plainB] = hash.mock.calls.map(([plain]) => plain as string);
    expect(plainA.length).toBeGreaterThanOrEqual(40);
    expect(plainA).not.toEqual(plainB);
    expect(JSON.stringify(first)).not.toContain(plainA);
    expect(JSON.stringify(first)).not.toContain(FAKE_HASH);
  });

  it('refuses when a SUPER_ADMIN already exists', async () => {
    const { tx, prisma } = setup({ existingAdmin: { id: 'role-1' } });

    await expect(createFirstAdmin(prisma, input, jest.fn())).rejects.toBeInstanceOf(
      FirstAdminRefusedError,
    );
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('refuses when the email already has an account (case-insensitive lookup)', async () => {
    const { tx, prisma } = setup({ existingUser: { id: 'user-1' } });

    await expect(createFirstAdmin(prisma, input, jest.fn())).rejects.toBeInstanceOf(
      FirstAdminRefusedError,
    );
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'admin.person@uni.ac.th', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it.each([
    ['not-an-email', 'Admin Person'],
    ['admin@uni.ac.th', '   '],
  ])('refuses invalid input %p / %p before touching the database', async (email, fullName) => {
    const { prisma } = setup();

    await expect(createFirstAdmin(prisma, { email, fullName }, jest.fn())).rejects.toBeInstanceOf(
      FirstAdminRefusedError,
    );
    expect((prisma as { $transaction: jest.Mock }).$transaction).not.toHaveBeenCalled();
  });
});

describe('run', () => {
  const argv = ['--email=admin.person@uni.ac.th', '--name=Admin Person'];

  it('is a dry run without --confirm', async () => {
    const { tx, prisma } = setup();
    const lines: string[] = [];

    await expect(run(argv, prisma, (l) => lines.push(l))).resolves.toBe(0);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(lines.join('\n')).toContain('Dry run');
  });

  it('never prints the full email or a hash', async () => {
    const { prisma } = setup();
    const lines: string[] = [];

    await expect(run([...argv, '--confirm'], prisma, (l) => lines.push(l))).resolves.toBe(0);
    const output = lines.join('\n');
    expect(output).toContain('a***@uni.ac.th');
    expect(output).not.toContain('admin.person@uni.ac.th');
    expect(output).not.toMatch(/\$2[aby]\$/);
  });

  it('exits 1 with the refusal reason when a SUPER_ADMIN exists', async () => {
    const { prisma } = setup({ existingAdmin: { id: 'role-1' } });
    const lines: string[] = [];

    await expect(run([...argv, '--confirm'], prisma, (l) => lines.push(l))).resolves.toBe(1);
    expect(lines.join('\n')).toContain('Refused');
  });

  it('prints only the error class for unexpected failures', async () => {
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED db:5432 password=hunter2')),
    };
    const lines: string[] = [];

    await expect(run([...argv, '--confirm'], prisma as never, (l) => lines.push(l))).resolves.toBe(
      1,
    );
    expect(lines.join('\n')).not.toContain('hunter2');
  });

  it('prints usage and exits 2 without both flags', async () => {
    const { prisma } = setup();
    await expect(run(['--confirm'], prisma, () => undefined, {})).resolves.toBe(2);
  });

  it('reads email and name from FIRST_ADMIN_EMAIL / FIRST_ADMIN_NAME (nothing in argv)', async () => {
    const { tx, prisma } = setup();
    const lines: string[] = [];
    const env = { FIRST_ADMIN_EMAIL: 'admin.person@uni.ac.th', FIRST_ADMIN_NAME: 'Admin Person' };

    await expect(run(['--confirm'], prisma, (l) => lines.push(l), env)).resolves.toBe(0);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin.person@uni.ac.th',
          fullName: 'Admin Person',
        }),
      }),
    );
    expect(lines.join('\n')).not.toContain('admin.person@uni.ac.th');
  });

  it('refuses an email longer than 254 characters', async () => {
    const { prisma } = setup();
    const email = `${'a'.repeat(250)}@uni.ac.th`;

    await expect(
      createFirstAdmin(prisma, { email, fullName: 'A' }, jest.fn()),
    ).rejects.toBeInstanceOf(FirstAdminRefusedError);
  });

  describe('test domains', () => {
    it.each([
      'demo-superadmin@test.local',
      'a@example.com',
      'a@sub.example.com',
      'a@localhost',
      'a@printer.local',
      'a@site.test',
      'a@site.invalid',
      'A@TEST.LOCAL',
    ])('refuses %s in Thai without touching the database', async (email) => {
      const { tx, prisma } = setup();
      const hash = jest.fn();

      await expect(createFirstAdmin(prisma, { email, fullName: 'A' }, hash)).rejects.toThrow(
        'โดเมนสำหรับทดสอบ',
      );
      expect(hash).not.toHaveBeenCalled();
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('accepts real-looking domains', async () => {
      const { prisma } = setup();
      await expect(
        createFirstAdmin(prisma, { email: 'a@gmail.com', fullName: 'A' }, jest.fn().mockResolvedValue(FAKE_HASH)),
      ).resolves.toMatchObject({ id: 'new-admin-id' });
    });

    it('refuses in the dry run too, so the shell script stops before asking', async () => {
      const { tx, prisma } = setup();
      const lines: string[] = [];
      const code = await run(
        ['--email=demo-superadmin@test.local', '--name=Demo'],
        prisma,
        (l) => lines.push(l),
        {},
      );
      expect(code).toBe(1);
      expect(lines.join('\n')).toContain('Refused: อีเมลนี้ใช้โดเมนสำหรับทดสอบ');
      expect(tx.user.create).not.toHaveBeenCalled();
    });
  });
});
