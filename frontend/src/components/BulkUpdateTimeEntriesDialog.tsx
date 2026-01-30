import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { Caregiver } from '@/types';

type UpdateField = 'caregiver_id' | 'hourly_rate';

interface BulkUpdateTimeEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  caregivers: Caregiver[];
  onConfirm: (field: UpdateField, value: string | number) => void;
  isLoading?: boolean;
}

export function BulkUpdateTimeEntriesDialog({
  open,
  onOpenChange,
  count,
  caregivers,
  onConfirm,
  isLoading = false,
}: BulkUpdateTimeEntriesDialogProps) {
  const [selectedField, setSelectedField] = useState<UpdateField | ''>('');
  const [caregiverId, setCaregiverId] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState<string>('');

  const activeCaregivers = caregivers.filter((c) => c.is_active);

  const handleSubmit = () => {
    if (selectedField === 'caregiver_id' && caregiverId) {
      onConfirm('caregiver_id', Number(caregiverId));
    } else if (selectedField === 'hourly_rate' && hourlyRate) {
      onConfirm('hourly_rate', hourlyRate);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset state when dialog closes
      setSelectedField('');
      setCaregiverId('');
      setHourlyRate('');
    }
    onOpenChange(open);
  };

  const isValid =
    (selectedField === 'caregiver_id' && caregiverId) ||
    (selectedField === 'hourly_rate' && hourlyRate && parseFloat(hourlyRate) > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {count} Time Entries</DialogTitle>
          <DialogDescription>
            Select a field to update and provide the new value. This will be applied to all selected entries.
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
                setCaregiverId('');
                setHourlyRate('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a field to update" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="caregiver_id">Caregiver</SelectItem>
                <SelectItem value="hourly_rate">Hourly Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Caregiver Selection */}
          {selectedField === 'caregiver_id' && (
            <div className="space-y-2">
              <Label>New Caregiver</Label>
              <Select value={caregiverId} onValueChange={setCaregiverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a caregiver" />
                </SelectTrigger>
                <SelectContent>
                  {activeCaregivers.map((caregiver) => (
                    <SelectItem key={caregiver.id} value={caregiver.id.toString()}>
                      {caregiver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Hourly Rate Input */}
          {selectedField === 'hourly_rate' && (
            <div className="space-y-2">
              <Label>New Hourly Rate ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="25.00"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
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
            {isLoading ? 'Updating...' : `Update ${count} Entries`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkUpdateTimeEntriesDialog;
