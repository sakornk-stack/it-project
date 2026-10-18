import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_VERSION } from './privacy-policy';
import { completeGoogleRegistrationSchema } from './validation/complete-google-registration.schema';
import { invitedRegisterSchema } from './validation/invited-register.schema';
import { registerSchema } from './validation/register.schema';

const UUID = 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';
const CONSENT_ERROR = 'กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร';

describe('PRIVACY_POLICY_VERSION', () => {
  it('is pinned (bump together with the backend PRIVACY_POLICY_VERSION)', () => {
    expect(PRIVACY_POLICY_VERSION).toBe('2026-10-18-draft.1');
  });

  it('keeps the AI section the disclosure notice links to', () => {
    expect(PRIVACY_POLICY_SECTIONS.map((s) => s.id)).toContain('ai');
  });
});

describe('sign-up schemas require the consent box', () => {
  const cases = [
    {
      name: 'registerSchema',
      schema: registerSchema,
      values: {
        email: 'new@ku.th',
        password: 'P@ssw0rd123',
        confirmPassword: 'P@ssw0rd123',
        fullName: 'New Student',
        studentCode: '6512345678',
        facultyId: UUID,
        departmentId: UUID,
        programId: UUID,
        curriculumId: UUID,
        admissionYear: 2568,
      },
    },
    {
      name: 'invitedRegisterSchema',
      schema: invitedRegisterSchema,
      values: { password: 'P@ssw0rd123', confirmPassword: 'P@ssw0rd123', fullName: 'New Student' },
    },
    {
      name: 'completeGoogleRegistrationSchema',
      schema: completeGoogleRegistrationSchema,
      values: {
        studentCode: '6512345678',
        facultyId: UUID,
        departmentId: UUID,
        programId: UUID,
        curriculumId: UUID,
        admissionYear: 2568,
      },
    },
  ];

  it.each(cases)('$name passes when the box is ticked', ({ schema, values }) => {
    expect(schema.safeParse({ ...values, acceptPrivacyPolicy: true }).success).toBe(true);
  });

  it.each(cases)('$name refuses an unticked box with the Thai message', ({ schema, values }) => {
    const result = schema.safeParse({ ...values, acceptPrivacyPolicy: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'acceptPrivacyPolicy');
      expect(issue?.message).toBe(CONSENT_ERROR);
    }
  });

  it.each(cases)('$name refuses a missing box', ({ schema, values }) => {
    expect(schema.safeParse(values).success).toBe(false);
  });
});
