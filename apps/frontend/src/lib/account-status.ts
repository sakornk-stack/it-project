import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import type { SemanticTone } from '@/lib/tone';

export interface AccountStatus {
  tone: SemanticTone;
  label: string;
  // Only a live account earns the pulsing dot.
  live: boolean;
}

// Suspended wins over "waiting for a password"; mustChangePassword stays true
// from creation until the user sets one.
export function accountStatus(
  user: Pick<AdminUserSummary, 'isActive' | 'mustChangePassword'>,
): AccountStatus {
  if (!user.isActive) return { tone: 'danger', label: 'ระงับการใช้งาน', live: false };
  if (user.mustChangePassword) return { tone: 'warning', label: 'รอตั้งรหัสผ่าน', live: false };
  return { tone: 'success', label: 'ใช้งานปกติ', live: true };
}
