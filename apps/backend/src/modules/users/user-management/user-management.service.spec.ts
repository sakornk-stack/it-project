import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { UserManagementService } from './user-management.service';

const scope = (programId: string) => ({
  id: `s-${programId}`,
  facultyId: null,
  departmentId: null,
  programId,
});

function requester(userId: string, roles: Role[]): RequestUser {
  return { userId, email: `${userId}@x.test`, roles, mustChangePassword: false };
}

function setup(opts: {
  target?: { roles: Role[]; scopes: ReturnType<typeof scope>[] } | null;
  coveredPrograms?: string[];
}) {
  const userService = {
    findOneWhere: jest.fn(async () => {
      if (!opts.target) throw new NotFoundException('User not found');
      return {
        id: 'target',
        scopes: opts.target.scopes,
        userRoles: opts.target.roles.map((role) => ({ role })),
      };
    }),
    setActiveStatus: jest.fn().mockResolvedValue({ id: 'target' }),
  };
  const userRoleService = {
    assignRole: jest.fn().mockResolvedValue({}),
    revokeRole: jest.fn().mockResolvedValue({}),
  };
  const covered = opts.coveredPrograms ?? [];
  const scopeResolver = {
    buildUserScopeOrFilter: jest.fn().mockResolvedValue([]),
    getEffectiveScopes: jest.fn().mockResolvedValue([]),
    isCovered: jest.fn((a: { programId: string | null }) => covered.includes(a.programId ?? '')),
  };
  const service = new UserManagementService(
    {} as never,
    userService as never,
    userRoleService as never,
    {} as never,
    scopeResolver as never,
    {} as never,
    {} as never,
  );
  return { service, userService, userRoleService };
}

const staff = (...programs: string[]) => ({
  roles: ['STAFF'] as Role[],
  scopes: programs.map(scope),
});

describe('UserManagementService.updateActiveStatus', () => {
  it('rejects suspending yourself with a Thai 403, before any lookup', async () => {
    const { service, userService } = setup({ target: staff('p1') });
    const call = service.updateActiveStatus('me', false, requester('me', ['ADMIN']));
    await expect(call).rejects.toThrow(ForbiddenException);
    await expect(call).rejects.toThrow('ไม่สามารถระงับ');
    expect(userService.setActiveStatus).not.toHaveBeenCalled();
  });

  it('rejects SUPER_ADMIN suspending themselves', async () => {
    const { service } = setup({ target: staff('p1') });
    await expect(
      service.updateActiveStatus('me', false, requester('me', ['SUPER_ADMIN'])),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([
    ['another ADMIN', ['ADMIN']],
    ['an ADMIN who also has STAFF', ['STAFF', 'ADMIN']],
    ['a SUPER_ADMIN', ['SUPER_ADMIN']],
    ['an INSTRUCTOR', ['INSTRUCTOR']],
  ] as [string, Role[]][])('ADMIN cannot suspend %s', async (_n, roles) => {
    const { service, userService } = setup({
      target: { roles, scopes: [scope('p1')] },
      coveredPrograms: ['p1'],
    });
    await expect(
      service.updateActiveStatus('target', false, requester('a1', ['ADMIN'])),
    ).rejects.toThrow('จัดการได้เฉพาะบัญชีเจ้าหน้าที่');
    expect(userService.setActiveStatus).not.toHaveBeenCalled();
  });

  it('ADMIN cannot reactivate another ADMIN either', async () => {
    const { service } = setup({
      target: { roles: ['ADMIN'], scopes: [scope('p1')] },
      coveredPrograms: ['p1'],
    });
    await expect(
      service.updateActiveStatus('target', true, requester('a1', ['ADMIN'])),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN suspends a STAFF whose scopes are all inside their own', async () => {
    const { service, userService } = setup({
      target: staff('p1', 'p2'),
      coveredPrograms: ['p1', 'p2'],
    });
    await service.updateActiveStatus('target', false, requester('a1', ['ADMIN']));
    expect(userService.setActiveStatus).toHaveBeenCalledWith('target', false);
  });

  it('ADMIN is refused account-wide suspend when one scope is outside, and told to remove their scope', async () => {
    const { service, userService } = setup({
      target: staff('p1', 'p9'),
      coveredPrograms: ['p1'],
    });
    const call = service.updateActiveStatus('target', false, requester('a1', ['ADMIN']));
    await expect(call).rejects.toThrow(ForbiddenException);
    await expect(call).rejects.toThrow('ถอดขอบเขตของคุณออก');
    expect(userService.setActiveStatus).not.toHaveBeenCalled();
  });

  it('ADMIN can still reactivate a multi-scope STAFF', async () => {
    const { service, userService } = setup({
      target: staff('p1', 'p9'),
      coveredPrograms: ['p1'],
    });
    await service.updateActiveStatus('target', true, requester('a1', ['ADMIN']));
    expect(userService.setActiveStatus).toHaveBeenCalledWith('target', true);
  });

  it('SUPER_ADMIN can suspend ADMIN and STAFF', async () => {
    for (const roles of [['ADMIN'], ['STAFF']] as Role[][]) {
      const { service, userService } = setup({
        target: { roles, scopes: [scope('p9')] },
      });
      await service.updateActiveStatus('target', false, requester('sa', ['SUPER_ADMIN']));
      expect(userService.setActiveStatus).toHaveBeenCalledWith('target', false);
    }
  });

  it('SUPER_ADMIN can reactivate a suspended ADMIN or STAFF, wherever their scopes are', async () => {
    for (const roles of [['ADMIN'], ['STAFF']] as Role[][]) {
      const { service, userService } = setup({ target: { roles, scopes: [scope('p9')] } });
      await service.updateActiveStatus('target', true, requester('sa', ['SUPER_ADMIN']));
      expect(userService.setActiveStatus).toHaveBeenCalledWith('target', true);
    }
  });

  it('nobody reactivates another SUPER_ADMIN through the API', async () => {
    const { service, userService } = setup({ target: { roles: ['SUPER_ADMIN'], scopes: [] } });
    await expect(
      service.updateActiveStatus('target', true, requester('sa', ['SUPER_ADMIN'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userService.setActiveStatus).not.toHaveBeenCalled();
  });

  it('keeps the 404 when the target is outside the ADMIN scope', async () => {
    const { service } = setup({ target: null });
    await expect(
      service.updateActiveStatus('target', false, requester('a1', ['ADMIN'])),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('UserManagementService role changes', () => {
  it('ADMIN cannot assign or revoke STAFF on another ADMIN', async () => {
    const { service, userRoleService } = setup({
      target: { roles: ['ADMIN'], scopes: [scope('p1')] },
      coveredPrograms: ['p1'],
    });
    const admin = requester('a1', ['ADMIN']);
    await expect(service.assignRole('target', 'STAFF', admin)).rejects.toThrow(ForbiddenException);
    await expect(service.revokeRole('target', 'STAFF', admin)).rejects.toThrow(ForbiddenException);
    expect(userRoleService.assignRole).not.toHaveBeenCalled();
    expect(userRoleService.revokeRole).not.toHaveBeenCalled();
  });

  it('ADMIN may revoke STAFF from a STAFF user in scope', async () => {
    const { service, userRoleService } = setup({
      target: staff('p1'),
      coveredPrograms: ['p1'],
    });
    await service.revokeRole('target', 'STAFF', requester('a1', ['ADMIN']));
    expect(userRoleService.revokeRole).toHaveBeenCalledWith('target', 'STAFF');
  });

  it('SUPER_ADMIN may grant ADMIN to a STAFF user', async () => {
    const { service, userRoleService } = setup({ target: staff('p1') });
    await service.assignRole('target', 'ADMIN', requester('sa', ['SUPER_ADMIN']));
    expect(userRoleService.assignRole).toHaveBeenCalledWith('target', 'ADMIN');
  });
});

describe('UserManagementService SUPER_ADMIN safeguards', () => {
  const sa = requester('sa', ['SUPER_ADMIN']);

  it.each([false, true])('SUPER_ADMIN cannot set another SUPER_ADMIN active=%s (Thai 403)', async (active) => {
    const { service, userService } = setup({
      target: { roles: ['SUPER_ADMIN'], scopes: [] },
    });
    const call = service.updateActiveStatus('target', active, sa);
    await expect(call).rejects.toThrow(ForbiddenException);
    await expect(call).rejects.toThrow('ผู้ดูแลระบบสูงสุดคนอื่น');
    expect(userService.setActiveStatus).not.toHaveBeenCalled();
  });

  it.each(['SUPER_ADMIN', 'ADMIN'] as Role[])(
    '%s cannot revoke a role from their own account',
    async (role) => {
      const { service, userRoleService } = setup({ target: staff('p1') });
      const call = service.revokeRole('me', 'STAFF', requester('me', [role]));
      await expect(call).rejects.toThrow(ForbiddenException);
      await expect(call).rejects.toThrow('ถอดบทบาทของตัวเอง');
      expect(userRoleService.revokeRole).not.toHaveBeenCalled();
    },
  );

  it.each(['SUPER_ADMIN', 'ADMIN'] as Role[])(
    '%s cannot grant a role to their own account (Thai 403)',
    async (role) => {
      const { service, userRoleService } = setup({ target: staff('p1') });
      const call = service.assignRole('me', 'STAFF', requester('me', [role]));
      await expect(call).rejects.toThrow(ForbiddenException);
      await expect(call).rejects.toThrow('กำหนดบทบาทให้ตัวเอง');
      expect(userRoleService.assignRole).not.toHaveBeenCalled();
    },
  );

  it('SUPER_ADMIN can still grant a role to someone else', async () => {
    const { service, userRoleService } = setup({ target: staff('p1') });
    await service.assignRole('target', 'ADMIN', sa);
    expect(userRoleService.assignRole).toHaveBeenCalledWith('target', 'ADMIN');
  });

  it('SUPER_ADMIN can still revoke a role from someone else', async () => {
    const { service, userRoleService } = setup({ target: staff('p1') });
    await service.revokeRole('target', 'STAFF', sa);
    expect(userRoleService.revokeRole).toHaveBeenCalledWith('target', 'STAFF');
  });
});

describe('UserManagementService.resendInvitation', () => {
  const TOKEN = 'super-secret-setup-token';

  function setupResend(opts: {
    target?: { roles: Role[]; mustChangePassword: boolean };
    covered?: boolean;
    emailFails?: boolean;
  }) {
    const target = opts.target ?? { roles: ['STAFF'], mustChangePassword: true };
    const userService = {
      findOneWhere: jest.fn().mockResolvedValue({
        id: 'target',
        email: 'target@x.test',
        mustChangePassword: target.mustChangePassword,
        scopes: [],
        userRoles: target.roles.map((role) => ({ role })),
      }),
    };
    const passwordResetService = { create: jest.fn().mockResolvedValue(TOKEN) };
    const emailService = {
      sendPasswordSetupEmail: opts.emailFails
        ? jest.fn().mockRejectedValue(new Error('SMTP down'))
        : jest.fn().mockResolvedValue(undefined),
    };
    const service = new UserManagementService(
      {} as never,
      userService as never,
      {} as never,
      {} as never,
      { buildUserScopeOrFilter: jest.fn().mockResolvedValue([]) } as never,
      passwordResetService as never,
      emailService as never,
    );
    return { service, userService, passwordResetService, emailService };
  }

  it('mails a fresh setup link to a user who has not set a password', async () => {
    const { service, passwordResetService, emailService } = setupResend({});
    const result = await service.resendInvitation('target', requester('sa', ['SUPER_ADMIN']));
    expect(passwordResetService.create).toHaveBeenCalledWith('target');
    expect(emailService.sendPasswordSetupEmail).toHaveBeenCalledWith(
      'target@x.test',
      TOKEN,
      'new-account',
    );
    expect(result).toEqual({ passwordSetupEmailSent: true });
  });

  it('answers 409 in Thai and sends nothing once the password is set', async () => {
    const { service, passwordResetService, emailService } = setupResend({
      target: { roles: ['STAFF'], mustChangePassword: false },
    });
    const error = await service
      .resendInvitation('target', requester('sa', ['SUPER_ADMIN']))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toContain('ตั้งรหัสผ่านแล้ว');
    expect(passwordResetService.create).not.toHaveBeenCalled();
    expect(emailService.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it('refuses to send to the requester themselves', async () => {
    const { service, emailService } = setupResend({});
    await expect(
      service.resendInvitation('sa', requester('sa', ['SUPER_ADMIN'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(emailService.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it.each<[string, Role[]]>([
    ['an ADMIN account', ['ADMIN']],
    ['a SUPER_ADMIN account', ['SUPER_ADMIN']],
    ['an account that is not STAFF', ['INSTRUCTOR']],
  ])('refuses an ADMIN requester on %s', async (_label, roles) => {
    const { service, emailService } = setupResend({ target: { roles, mustChangePassword: true } });
    await expect(
      service.resendInvitation('target', requester('adm', ['ADMIN'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(emailService.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it('answers 404 (not 403) for a target outside the ADMIN scope and sends nothing', async () => {
    const { service, userService, emailService } = setupResend({});
    userService.findOneWhere.mockRejectedValue(new NotFoundException('User not found'));
    await expect(
      service.resendInvitation('target', requester('adm', ['ADMIN'])),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(emailService.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it('lets a SUPER_ADMIN resend to another SUPER_ADMIN', async () => {
    const { service, emailService } = setupResend({
      target: { roles: ['SUPER_ADMIN'], mustChangePassword: true },
    });
    await service.resendInvitation('target', requester('sa', ['SUPER_ADMIN']));
    expect(emailService.sendPasswordSetupEmail).toHaveBeenCalled();
  });

  it('answers 503 in Thai when the email cannot be sent, not a silent success', async () => {
    const { service } = setupResend({ emailFails: true });
    const error = await service
      .resendInvitation('target', requester('sa', ['SUPER_ADMIN']))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).message).toContain('ส่งอีเมลไม่สำเร็จ');
  });

  it('never writes the setup token to any log channel', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const logConsole = jest.spyOn(console, 'log').mockImplementation();
    const { service } = setupResend({});
    await service.resendInvitation('target', requester('sa', ['SUPER_ADMIN']));
    const logged = JSON.stringify([
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...logConsole.mock.calls,
    ]);
    expect(logged).not.toContain(TOKEN);
    expect(logSpy).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});

describe('UserManagementService.listInstructors', () => {
  it('asks only for active INSTRUCTOR users and returns id, fullName and email', async () => {
    const userService = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'i1', fullName: 'อาจารย์ หนึ่ง', email: 'i1@x.test', userRoles: [], scopes: [] },
      ]),
    };
    const service = new UserManagementService(
      {} as never,
      userService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.listInstructors();

    expect(userService.findAll).toHaveBeenCalledWith({
      isActive: true,
      userRoles: { some: { role: 'INSTRUCTOR' } },
    });
    expect(result).toEqual([{ id: 'i1', fullName: 'อาจารย์ หนึ่ง', email: 'i1@x.test' }]);
  });
});
