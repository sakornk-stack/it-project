import { AxiosError, AxiosHeaders } from 'axios';
import { STALE_PRIVACY_POLICY_MESSAGE } from './privacy-policy';
import { isStalePrivacyPolicyError } from './privacy-policy-error';

function apiError(status: number, message: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('x', 'ERR', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { message },
  });
}

describe('isStalePrivacyPolicyError', () => {
  it('spots the backend stale-version 400', () => {
    expect(isStalePrivacyPolicyError(apiError(400, STALE_PRIVACY_POLICY_MESSAGE))).toBe(true);
  });

  it('ignores other 400s, other statuses and non-HTTP errors', () => {
    expect(isStalePrivacyPolicyError(apiError(400, 'curriculum mismatch'))).toBe(false);
    expect(isStalePrivacyPolicyError(apiError(409, STALE_PRIVACY_POLICY_MESSAGE))).toBe(false);
    expect(isStalePrivacyPolicyError(new Error('boom'))).toBe(false);
  });
});
