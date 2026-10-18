import { ForbiddenException } from '@nestjs/common';

export type GoogleSignupRefusal = 'email_unverified' | 'domain_not_allowed';

// Thrown by AuthService.handleGoogleCallback when Google's own claims rule the
// person out; AuthController turns `reason` into /login?googleError=<reason>.
// Its own file so the controller (and its spec, which mocks AuthService) can
// import it without the service.
export class GoogleSignupRefusedException extends ForbiddenException {
  constructor(readonly reason: GoogleSignupRefusal) {
    super(reason);
  }
}
