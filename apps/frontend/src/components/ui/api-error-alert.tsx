import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BORDER_TONE_CLASSES, TINT_TONE_CLASSES } from '@/lib/tone';

// The box every /admin/** page shows for an error the API returned. A warning
// look (not the destructive red) so it reads in both themes, and role="alert"
// so a screen reader announces it when it appears.
export const WARNING_ALERT_CLASS = `${BORDER_TONE_CLASSES.warning} ${TINT_TONE_CLASSES.warning} text-amber-900`;

export function ApiErrorAlert({
  message,
  onDismiss,
  onRetry,
}: Readonly<{ message: string; onDismiss?: () => void; onRetry?: () => void }>) {
  return (
    <Alert role="alert" className={WARNING_ALERT_CLASS}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <AlertDescription>{message}</AlertDescription>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="[@media(pointer:coarse)]:min-h-11"
              onClick={onRetry}
            >
              ลองอีกครั้ง
            </Button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="ปิดข้อความนี้"
            className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </Alert>
  );
}
