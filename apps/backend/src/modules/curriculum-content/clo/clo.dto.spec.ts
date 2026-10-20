import { ValidationPipe } from '@nestjs/common';
import { UpdateCloDto } from './dto/update-clo.dto';
import { CreateCloDto } from './dto/create-clo.dto';

// The same pipe options as main.ts: unknown fields are rejected (400), so a field
// the frontend sends that a DTO lacks fails the whole save.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = (type: new () => object, body: object) =>
  pipe.transform(body, { type: 'body', metatype: type });

describe('CLO DTOs accept exactly what the outcomes page sends', () => {
  it('update: code, description, threshold, isConfirmed', async () => {
    const body = {
      code: 'CLO1',
      description: 'd',
      achievementThreshold: 50,
      isConfirmed: true,
    };
    await expect(run(UpdateCloDto, body)).resolves.toEqual(body);
  });

  it('update: a cleared threshold is null and passes', async () => {
    const body = { code: 'CLO1', achievementThreshold: null, isConfirmed: true };
    await expect(run(UpdateCloDto, body)).resolves.toEqual(body);
  });

  it('update: confirm only', async () => {
    await expect(run(UpdateCloDto, { isConfirmed: true })).resolves.toEqual({ isConfirmed: true });
  });

  it('update refuses courseId (parent is immutable)', async () => {
    await expect(run(UpdateCloDto, { courseId: 'x' })).rejects.toBeDefined();
  });

  it('create: body from toCreateCloBody', async () => {
    const body = {
      courseId: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d',
      code: 'CLO1',
      description: 'd',
      isConfirmed: true,
    };
    await expect(run(CreateCloDto, body)).resolves.toEqual(body);
  });
});
