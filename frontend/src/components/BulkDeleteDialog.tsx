import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  itemLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  itemLabel = 'item',
  onConfirm,
  isLoading = false,
}: BulkDeleteDialogProps) {
  const pluralLabel = count === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete {count} {pluralLabel}?
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the selected {pluralLabel}.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Warning</p>
          <p>You are about to delete {count} {pluralLabel}. This action cannot be undone.</p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : `Delete ${count} ${pluralLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkDeleteDialog;
