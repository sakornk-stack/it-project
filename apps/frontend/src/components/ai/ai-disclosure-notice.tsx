import Link from 'next/link';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_DISCLOSURE_NOTE } from '@/lib/ai-disclosure';
import { PRIVACY_POLICY_PATH } from '@/lib/privacy-policy';

// Notice to place before a button that calls the Anthropic-backed analysis
// (see lib/ai-disclosure.ts for where it may and may not go).
export function AiDisclosureNotice({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-lg border bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground',
        className,
      )}
    >
      <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>
        {AI_DISCLOSURE_NOTE}{' '}
        <Link
          href={`${PRIVACY_POLICY_PATH}#ai`}
          target="_blank"
          rel="noopener"
          className="font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          อ่านเพิ่มเติม
        </Link>
      </p>
    </div>
  );
}
