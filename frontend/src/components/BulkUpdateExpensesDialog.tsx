import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExpenseCategory } from '@/types';

type UpdateField = 'paid_by' | 'category';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Utilities',
  'Groceries',
  'Medical',
  'Caregiver Payment',
  'Insurance',
  'Supplies',
  'Other',
];

interface BulkUpdateExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: (field: UpdateField, value: string) => void;
  isLoading?: boolean;
}

export function BulkUpdateExpensesDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  isLoading = false,
}: BulkUpdateExpensesDialogProps) {
  const [selectedField, setSelectedField] = useState<UpdateField | ''>('');
  const [paidBy, setPaidBy] = useState<string>('');
  const [category, setCategory] = useState<string>('');

  const handleSubmit = () => {
    if (selectedField === 'paid_by' && paidBy) {
      onConfirm('paid_by', paidBy);
    } else if (selectedField === 'category' && category) {
      onConfirm('category', category);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset state when dialog closes
      setSelectedField('');
      setPaidBy('');
      setCategory('');
    }
    onOpenChange(open);
  };

  const isValid =
    (selectedField === 'paid_by' && paidBy) ||
    (selectedField === 'category' && category);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {count} Expenses</DialogTitle>
          <DialogDescription>
            Select a field to update and provide the new value. This will be applied to all selected expenses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Selection */}
          <div className="space-y-2">
            <Label>Field to Update</Label>
            <Select
              value={selectedField}
              onValueChange={(value) => {
                setSelectedField(value as UpdateField);
                // Reset values when field changes
                setPaidBy('');
                setCategory('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a field to update" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid_by">Paid By</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Paid By Selection */}
          {selectedField === 'paid_by' && (
            <div className="space-y-2">
              <Label>New Paid By</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select who paid" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Adi">Adi</SelectItem>
                  <SelectItem value="Rafi">Rafi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category Selection */}
          {selectedField === 'category' && (
            <div className="space-y-2">
              <Label>New Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
          >
            {isLoading ? 'Updating...' : `Update ${count} Expenses`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkUpdateExpensesDialog;
