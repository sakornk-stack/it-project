import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TwoFactorService, TWO_FACTOR_ALREADY_ENABLED_MESSAGE } from './two-factor.service';

// otplib is ESM-only (Jest can't parse it); setup() only needs these two.
jest.mock('otplib', () => ({
  generateSecret: () => 'TESTSECRET',
  generateURI: () => 'otpauth://test',
  verify: jest.fn(),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,x') }));

function setup(existing: { enabled: boolean } | null) {
  const credential = {
    findUnique: jest.fn().mockResolvedValue(existing),
    upsert: jest.fn().mockResolvedValue({}),
  };
  const config = { get: () => '00'.repeat(32) };
  const service = new TwoFactorService(
    { twoFactorCredential: credential } as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  return { service, credential };
}

describe('TwoFactorService.setup', () => {
  it('refuses with a Thai 409 and leaves the credential untouched when 2FA is already enabled', async () => {
    const { service, credential } = setup({ enabled: true });
    const result = service.setup('u1', 'u@test.local');
    await expect(result).rejects.toThrow(ConflictException);
    await expect(result).rejects.toThrow(TWO_FACTOR_ALREADY_ENABLED_MESSAGE);
    expect(credential.upsert).not.toHaveBeenCalled();
  });

  it('still overwrites a pending (not yet enabled) credential', async () => {
    const { service, credential } = setup({ enabled: false });
    await expect(service.setup('u1', 'u@test.local')).resolves.toHaveProperty('qrCodeDataUrl');
    expect(credential.upsert).toHaveBeenCalledTimes(1);
  });

  it('creates a credential when none exists', async () => {
    const { service, credential } = setup(null);
    await service.setup('u1', 'u@test.local');
    expect(credential.upsert).toHaveBeenCalledTimes(1);
  });
});
