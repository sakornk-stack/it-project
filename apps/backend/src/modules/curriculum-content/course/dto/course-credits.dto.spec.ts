import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCourseDto } from './create-course.dto';
import { UpdateCourseDto } from './update-course.dto';

const BODY = {
  code: '01418111',
  name: 'วิชา',
  curriculumId: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d',
  categoryId: 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d',
};

async function creditErrors(dtoClass: new () => object, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(dtoClass, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.filter((error) => error.property === 'credits').length;
}

// Credits are whole numbers 0–12 on both create and update.
describe('course credits', () => {
  it.each([0, 1, 3, 12])('accepts %d', async (credits) => {
    expect(await creditErrors(CreateCourseDto, { ...BODY, credits })).toBe(0);
    expect(await creditErrors(UpdateCourseDto, { credits })).toBe(0);
  });

  it.each([-1, 13, 2.5, '3'])('rejects %p', async (credits) => {
    expect(await creditErrors(CreateCourseDto, { ...BODY, credits })).toBe(1);
    expect(await creditErrors(UpdateCourseDto, { credits })).toBe(1);
  });
});
