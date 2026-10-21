'use client';

import * as React from 'react';
import { Check, Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BAR_TONE_CLASSES, TEXT_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import {
  evaluatePasswordStrength,
  type PasswordRequirements,
} from '@/lib/password-strength';
import { Input } from '@/components/ui/input';

const STRENGTH_LABEL_TH: Record<ReturnType<typeof evaluatePasswordStrength>['level'], string> = {
  weak: 'อ่อน',
  medium: 'ปานกลาง',
  strong: 'แข็งแรง',
};

const STRENGTH_TONE: Record<ReturnType<typeof evaluatePasswordStrength>['level'], SemanticTone> = {
  weak: 'danger',
  medium: 'warning',
  strong: 'success',
};

const STRENGTH_WIDTH: Record<ReturnType<typeof evaluatePasswordStrength>['level'], string> = {
  weak: 'w-1/3',
  medium: 'w-2/3',
  strong: 'w-full',
};

const REQUIREMENT_ITEMS: Array<{ key: keyof PasswordRequirements; label: string; optional?: boolean }> = [
  { key: 'minLength', label: 'อย่างน้อย 8 ตัวอักษร' },
  { key: 'uppercase', label: 'ตัวพิมพ์ใหญ่ (A-Z)' },
  { key: 'lowercase', label: 'ตัวพิมพ์เล็ก (a-z)' },
  { key: 'number', label: 'ตัวเลข (0-9)' },
  { key: 'specialChar', label: 'อักขระพิเศษ (แนะนำ)', optional: true },
];

// Live typing guide only — never the source of truth for validity. Actual
// pass/fail still comes entirely from registerSchema/passwordSchema via
// FormMessage, unchanged. Unsatisfied items are neutral gray, never red —
// mid-typing, an unmet requirement is normal, not an error.
function PasswordStrengthMeter({ password }: Readonly<{ password: string }>) {
  const { requirements, level } = evaluatePasswordStrength(password);

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">ความปลอดภัยของรหัสผ่าน</span>
        <span
          className={cn(
            'font-medium',
            level === 'weak' && TEXT_TONE_CLASSES.danger,
            level === 'medium' && TEXT_TONE_CLASSES.warning,
            level === 'strong' && TEXT_TONE_CLASSES.success,
          )}
        >
          {STRENGTH_LABEL_TH[level]}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            BAR_TONE_CLASSES[STRENGTH_TONE[level]],
            STRENGTH_WIDTH[level],
          )}
        />
      </div>

      <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        {REQUIREMENT_ITEMS.map((item) => {
          const met = requirements[item.key];
          return (
            <li key={item.key} className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                  met
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-input bg-transparent text-transparent',
                )}
                aria-hidden="true"
              >
                <Check size={10} strokeWidth={3} />
              </span>
              <span className={cn(met ? 'text-foreground/80' : 'text-muted-foreground')}>
                {item.label}
                <span className="sr-only">{met ? ' (ผ่านแล้ว)' : ' (ยังไม่ผ่าน)'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Show the live strength meter + requirement checklist below the field. */
  showStrength?: boolean;
  toggleAriaLabels?: { show: string; hide: string };
}

// FormControl (Radix Slot) clones id/aria-invalid/aria-describedby/ref
// onto this component's single returned element — so those props are
// deliberately extracted and applied to the real <input> below, never to
// the wrapping <div>, to keep label/error association correct.
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength, toggleAriaLabels, value, onChange, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const stringValue = typeof value === 'string' ? value : '';

    return (
      <div className="space-y-2">
        <div className="relative">
          <Lock
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            className={cn(
              'h-11 rounded-lg pl-9 pr-11 transition-colors duration-200',
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:scale-90"
            aria-label={
              visible
                ? (toggleAriaLabels?.hide ?? 'ซ่อนรหัสผ่าน')
                : (toggleAriaLabels?.show ?? 'แสดงรหัสผ่าน')
            }
          >
            {visible ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        </div>

        {showStrength && stringValue.length > 0 && <PasswordStrengthMeter password={stringValue} />}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
