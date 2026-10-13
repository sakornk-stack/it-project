import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

// One-line "nothing left to do" bar that replaces a large empty state. The
// check icon plus the sentence carry the meaning, so it never relies on colour alone.
export function SuccessStrip({
  label,
  message,
  action,
}: Readonly<{ label: string; message: string; action?: ReactNode }>) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <CheckCircle2 size={18} aria-hidden="true" className="shrink-0" />
        {message}
      </p>
      {action}
    </section>
  );
}
