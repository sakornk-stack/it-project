import { BadRequestException } from '@nestjs/common';

// Version of the privacy policy page (apps/frontend/src/lib/privacy-policy.ts
// carries the same string — shared-types is types-only, so it lives in both).
// Bump both together whenever the policy text changes; a sign-up sent with any
// other version is refused, so the stored version is always the one the
// person actually saw.
export const PRIVACY_POLICY_VERSION = '2026-10-18-draft.1';

export const STALE_PRIVACY_POLICY_MESSAGE =
  'นโยบายความเป็นส่วนตัวมีการปรับปรุง กรุณาโหลดหน้าใหม่แล้วสมัครอีกครั้ง';

export function assertCurrentPrivacyPolicyVersion(version: string): void {
  if (version !== PRIVACY_POLICY_VERSION) {
    throw new BadRequestException(STALE_PRIVACY_POLICY_MESSAGE);
  }
}
