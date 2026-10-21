import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'otplib';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret } from '../../common/util/crypto.util';
import { TwoFactorService } from './two-factor.service';

// otplib is ESM-only (Jest can't parse it). The mock throws on anything but
// six digits, the way the real verify() does ("Token must be 6 digits"), so
// these tests fail if a malformed code ever reaches it again.
jest.mock('otplib', () => ({
  generateSecret: () => 'TESTSECRET',
  generateURI: () => 'otpauth://test',
  verify: jest.fn(async ({ token }: { token: string }) => {
    if (!/^\d{6}$/.test(token)) throw new Error(`Token must be 6 digits, got ${token.length}`);
    return { valid: token === '123456' };
  }),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));

const KEY = '00'.repeat(32);
const verifyMock = verify as unknown as jest.Mock;

function setup(enabled: boolean) {
  const credential = {
    findUnique: jest.fn().mockResolvedValue({
      userId: 'u1',
      enabled,
      secretCiphertext: encryptSecret('TESTSECRET', KEY),
      recoveryCodeHashes: [],
    }),
    update: jest.fn().mockResolvedValue({}),
  };
  const service = new TwoFactorService(
    { twoFactorCredential: credential } as unknown as PrismaService,
    { get: () => KEY } as unknown as ConfigService,
  );
  return { service, credential };
}

const MALFORMED = ['12345', '1234567', 'abcdef', '123 456', ''];

beforeEach(() => verifyMock.mockClear());

describe('TwoFactorService: a malformed TOTP code is a wrong code, never a 500', () => {
  it.each(MALFORMED)('login step (%j): false, otplib never called', async (code) => {
    const { service } = setup(true);
    await expect(service.verifyLoginCode('u1', code)).resolves.toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it.each(MALFORMED)('enable (%j): 401, nothing written', async (code) => {
    const { service, credential } = setup(false);
    await expect(service.enable('u1', code)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(credential.update).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it.each(MALFORMED)('regenerate recovery codes (%j): 401, nothing written', async (code) => {
    const { service, credential } = setup(true);
    await expect(service.regenerateRecoveryCodes('u1', code)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(credential.update).not.toHaveBeenCalled();
  });

  it('a well-formed code still goes to otplib: right code passes, wrong code fails', async () => {
    const { service } = setup(true);
    await expect(service.verifyLoginCode('u1', '123456')).resolves.toBe(true);
    await expect(service.verifyLoginCode('u1', '654321')).resolves.toBe(false);
    expect(verifyMock).toHaveBeenCalledTimes(2);
  });
});
