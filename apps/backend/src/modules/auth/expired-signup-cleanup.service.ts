import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EmailSignupRequestService } from './email-signup-request.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';

export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
// Rows stay this long past expiry. Must be ≥ the email sign-up send window
// (24h) so deleting a row can never reset its per-address send cap.
export const CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;

// Hourly in-process sweep of expired sign-up rows (no scheduler library in
// this project, so a plain unref'd timer). deleteMany is idempotent, so
// several instances running it at once is harmless. Logs counts only — the
// rows hold emails and token hashes, and nothing here is audited.
@Injectable()
export class ExpiredSignupCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ExpiredSignupCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly emailSignupRequestService: EmailSignupRequestService,
    private readonly googlePendingRegistrationService: GooglePendingRegistrationService,
  ) {}

  onApplicationBootstrap() {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  // Never throws: a failed sweep is logged and the next tick tries again.
  async runOnce(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const cutoff = new Date(now.getTime() - CLEANUP_GRACE_MS);
      const emailRows = await this.emailSignupRequestService.deleteExpiredBefore(cutoff);
      const googleRows = await this.googlePendingRegistrationService.deleteExpiredBefore(cutoff);
      if (emailRows || googleRows) {
        this.logger.log(
          `Removed expired sign-up rows: email_signup_requests=${emailRows}, google_pending_registrations=${googleRows}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Expired sign-up cleanup failed: ${error instanceof Error ? error.name : 'unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
