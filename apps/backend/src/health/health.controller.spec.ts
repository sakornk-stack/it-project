import { ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { HealthController } from './health.controller';

const makeController = (queryRaw: jest.Mock) =>
  new HealthController({ $queryRaw: queryRaw } as never);

describe('HealthController', () => {
  it('returns ok when the database answers', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    await expect(makeController(queryRaw).check()).resolves.toEqual({ status: 'ok' });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('answers 503 without leaking the database error', async () => {
    const queryRaw = jest
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED db-host:5432 password=hunter2'));
    const controller = makeController(queryRaw);

    const error = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = (error as ServiceUnavailableException).getResponse();
    expect(body).toEqual({ status: 'error' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('is public: no guards on the class or the handler', () => {
    const reflector = new Reflector();
    expect(reflector.get(GUARDS_METADATA, HealthController)).toBeUndefined();
    expect(reflector.get(GUARDS_METADATA, HealthController.prototype.check)).toBeUndefined();
    expect(reflector.get('roles', HealthController.prototype.check)).toBeUndefined();
  });
});
