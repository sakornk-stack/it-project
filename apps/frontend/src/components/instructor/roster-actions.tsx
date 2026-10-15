import { Download, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The two buttons at the right of the roster card's header: edit mode (only on
// the instructor's own course) and the CSV export of what the list shows.
export function RosterActions({
  canEdit,
  editMode,
  onToggleEdit,
  canExport,
  onExport,
}: Readonly<{
  canEdit: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
  canExport: boolean;
  onExport: () => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Button
          type="button"
          variant={editMode ? 'default' : 'outline'}
          aria-pressed={editMode}
          className="h-11"
          onClick={onToggleEdit}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {editMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขเกรด'}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={!canExport}
        onClick={onExport}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        ส่งออก CSV
      </Button>
    </div>
  );
}
