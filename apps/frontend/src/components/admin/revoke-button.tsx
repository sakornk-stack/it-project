import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The outline button, quiet until hovered or focused, then destructive-toned, that starts removing a role or a scope. The
// removal itself waits for the confirm dialog.
export function RevokeButton({
  label,
  onClick,
  className,
}: Readonly<{ label: string; onClick: () => void; className?: string }>) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'border-border text-muted-foreground transition-colors duration-150 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive active:border-destructive/50 active:bg-destructive/10 active:text-destructive motion-reduce:transition-none',
        className,
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

// The same action as a trash icon inside a card that carries `interactive-row`:
// muted at rest, red on hover or focus (also when its row is). The tooltip and
// the aria-label say what it removes.
export function RevokeIconButton({
  label,
  onClick,
}: Readonly<{ label: string; onClick: () => void }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          className="row-action shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive"
          onClick={onClick}
        >
          <Trash2 size={18} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
