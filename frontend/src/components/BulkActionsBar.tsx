import { X, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onUpdate: () => void;
  onClearSelection: () => void;
  itemLabel?: string;
}

export function BulkActionsBar({
  selectedCount,
  onDelete,
  onUpdate,
  onClearSelection,
  itemLabel = 'item',
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  const pluralLabel = selectedCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">
          {selectedCount} {pluralLabel} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUpdate}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Update Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="gap-2"
      >
        <X className="h-4 w-4" />
        Clear Selection
      </Button>
    </div>
  );
}

export default BulkActionsBar;
