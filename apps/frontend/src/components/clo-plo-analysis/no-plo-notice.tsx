import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { NO_PLO_CURRICULUM_DESCRIPTION, NO_PLO_CURRICULUM_TITLE } from '@/lib/plo-notes';

// Curricula with no PLO/CLO at all (e.g. ACC): an explanation, not an error or an empty chart.
export function NoPloNotice() {
  return (
    <Card>
      <CardContent>
        <EmptyState
          illustration="no-outcomes"
          description={
            <>
              <span className="block font-medium text-primary">{NO_PLO_CURRICULUM_TITLE}</span>
              <span className="block text-sm">{NO_PLO_CURRICULUM_DESCRIPTION}</span>
            </>
          }
        />
      </CardContent>
    </Card>
  );
}
