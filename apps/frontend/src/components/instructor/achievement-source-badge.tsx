import type { EvidenceSource } from '@eduanalyze-ai/shared-types';
import { Badge } from '@/components/ui/badge';
import { GRADE_ESTIMATE_LABEL } from '@/lib/grade-estimate';
import type { SemanticTone } from '@/lib/tone';

// States where a number came from, so a grade estimate can never be mistaken
// for real evidence. The backend puts `source` on every AchievementResult and
// resolves to NO_EVIDENCE rather than silently falling back to grades, so this
// badge just surfaces a decision already made server-side.
//
// Sibling of evidence-coverage-badge.tsx: the two answer different questions
// ("computed from what?" vs "how much of it is in?") and are meant to sit
// next to each other. Same shared tone vocabulary, no new tone needed.
const SOURCE_PRESENTATION: Record<EvidenceSource, { tone: SemanticTone; label: string }> = {
  EVIDENCE_BASED: { tone: 'success', label: 'จากคะแนนที่กรอกจริง' },
  LEGACY_GRADE_ESTIMATE: { tone: 'warning', label: GRADE_ESTIMATE_LABEL },
  NO_EVIDENCE: { tone: 'neutral', label: 'ยังไม่มีคะแนนที่กรอก' },
};

export function AchievementSourceBadge({ source }: Readonly<{ source: EvidenceSource }>) {
  const { tone, label } = SOURCE_PRESENTATION[source];
  return <Badge tone={tone}>{label}</Badge>;
}
