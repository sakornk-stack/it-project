import { Button } from '@/components/ui/button';

// The outline destructive-tone button that starts removing a role or a scope. The
// removal itself waits for the confirm dialog.
export function RevokeButton({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
  return (
    <Button
      type="button"
      variant="outline"
      className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
