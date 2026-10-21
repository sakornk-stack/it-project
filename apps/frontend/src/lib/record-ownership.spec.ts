import { isSelfEnteredRecord } from './record-ownership';

describe('isSelfEnteredRecord', () => {
  it('is true for a row the student entered, or a legacy row with no writer', () => {
    expect(isSelfEnteredRecord({ enteredByRole: 'STUDENT' })).toBe(true);
    expect(isSelfEnteredRecord({ enteredByRole: null })).toBe(true);
  });

  it.each(['STAFF', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'] as const)(
    'is false for a row entered by %s',
    (role) => {
      expect(isSelfEnteredRecord({ enteredByRole: role })).toBe(false);
    },
  );
});
