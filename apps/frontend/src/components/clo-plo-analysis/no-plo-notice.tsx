import { Network } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { NO_PLO_CURRICULUM_DESCRIPTION, NO_PLO_CURRICULUM_TITLE } from '@/lib/plo-notes';

// Curricula with no PLO/CLO at all (e.g. ACC): an explanation, not an error or an empty chart.
export function NoPloNotice() {
  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={Network}
          title={NO_PLO_CURRICULUM_TITLE}
          description={NO_PLO_CURRICULUM_DESCRIPTION}
        />
      </CardContent>
    </Card>
  );
}
