import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PRIVACY_POLICY_LINK_LABEL, PRIVACY_POLICY_PATH } from '@/lib/privacy-policy';

// The small "privacy policy" line at the foot of the sign-in shell and of
// every role's DashboardShell. 44px tall so it stays an easy tap target.
export function PrivacyFooterLink({ className }: Readonly<{ className?: string }>) {
  return (
    <p className={cn('text-center text-xs text-muted-foreground', className)}>
      <Link
        href={PRIVACY_POLICY_PATH}
        className="inline-flex min-h-11 items-center px-2 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {PRIVACY_POLICY_LINK_LABEL}
      </Link>
    </p>
  );
}
