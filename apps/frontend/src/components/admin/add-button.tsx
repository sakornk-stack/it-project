import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// The outline "add" button that stays empty-handed until a choice is made.
// The central disabled look (half opacity) turns the label unreadable on the
// outline variant, so it is swapped for a flat muted fill; a hint under the
// field says what is missing.
export function AddButton({
  className,
  ...props
}: Readonly<Omit<React.ComponentProps<typeof Button>, 'variant'>>) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100',
        className,
      )}
      {...props}
    />
  );
}
