import { cn } from '@/lib/utils';

// A labelled on/off switch (role=switch). The whole row is the target, so it stays 44px tall.
export function Switch({
  checked,
  onCheckedChange,
  children,
  className,
}: Readonly<{
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex min-h-11 items-center gap-2.5 rounded-md px-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 motion-reduce:transition-none',
          checked ? 'border-brand bg-brand' : 'border-input bg-slate-200',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none',
            checked && 'translate-x-4',
          )}
        />
      </span>
      {children}
    </button>
  );
}
