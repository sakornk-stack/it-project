import { isAxiosError } from 'axios';
import { STALE_PRIVACY_POLICY_MESSAGE } from './privacy-policy';

// Sign-up forms map every 400 to their own field message; this lets them tell
// "the policy changed under you" apart from a bad curriculum choice.
export function isStalePrivacyPolicyError(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 400) return false;
  const message = (error.response.data as { message?: unknown } | undefined)?.message;
  return message === STALE_PRIVACY_POLICY_MESSAGE;
}
