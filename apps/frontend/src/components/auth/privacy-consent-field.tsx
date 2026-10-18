'use client';

import Link from 'next/link';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PRIVACY_POLICY_LINK_LABEL, PRIVACY_POLICY_PATH } from '@/lib/privacy-policy';

// The consent box on every sign-up form (self-service, invitation, Google).
// Lives inside <Form> and binds to `acceptPrivacyPolicy` (acceptPrivacyPolicySchema).
// The whole row is the label so the tap target is ≥44px; the policy opens in a
// new tab so a half-filled form is never lost.
export function PrivacyConsentField() {
  const { control } = useFormContext<{ acceptPrivacyPolicy: boolean }>();
  return (
    <FormField
      control={control}
      name="acceptPrivacyPolicy"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm font-normal leading-6">
            <FormControl>
              <input
                type="checkbox"
                name={field.name}
                ref={field.ref}
                checked={field.value === true}
                onChange={(event) => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
              />
            </FormControl>
            <span className="text-muted-foreground">
              ฉันได้อ่านและยอมรับ{' '}
              <Link
                href={PRIVACY_POLICY_PATH}
                target="_blank"
                rel="noopener"
                className="font-medium text-brand underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {PRIVACY_POLICY_LINK_LABEL}
              </Link>
            </span>
          </FormLabel>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
