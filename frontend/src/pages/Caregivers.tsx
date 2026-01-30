import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, UserCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {
  useCaregivers,
  useCreateCaregiver,
  useUpdateCaregiver,
  useDeactivateCaregiver,
} from '@/hooks/use-api';
import type { Caregiver } from '@/types';

// Form validation schema
const caregiverFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  default_hourly_rate: z.string().min(1, 'Hourly rate is required'),
  is_active: z.boolean().optional(),
});

type CaregiverFormValues = z.infer<typeof caregiverFormSchema>;

interface CaregiverDialogProps {
  caregiver?: Caregiver;
  onClose: () => void;
}

function CaregiverDialog({ caregiver, onClose }: CaregiverDialogProps) {
  const createCaregiver = useCreateCaregiver();
  const updateCaregiver = useUpdateCaregiver();

  const isEditing = !!caregiver;

  const form = useForm<CaregiverFormValues>({
    resolver: zodResolver(caregiverFormSchema),
    defaultValues: {
      name: caregiver?.name || '',
      default_hourly_rate: caregiver?.default_hourly_rate || '15.00',
      is_active: caregiver?.is_active ?? true,
    },
  });

  const onSubmit = async (values: CaregiverFormValues) => {
    const data = {
      name: values.name,
      default_hourly_rate: values.default_hourly_rate,
      is_active: values.is_active,
    };

    try {
      if (isEditing) {
        await updateCaregiver.mutateAsync({ id: caregiver.id, data });
      } else {
        await createCaregiver.mutateAsync(data);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save caregiver:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter caregiver name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="default_hourly_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Hourly Rate ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="15.00"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEditing && (
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Is Active</FormLabel>
                </div>
              </FormItem>
            )}
          />
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={createCaregiver.isPending || updateCaregiver.isPending}
          >
            {createCaregiver.isPending || updateCaregiver.isPending
              ? 'Saving...'
              : isEditing
              ? 'Update'
              : 'Add Caregiver'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function Caregivers() {
  const [showAll, setShowAll] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCaregiver, setEditingCaregiver] = useState<Caregiver | undefined>();
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingCaregiver, setDeactivatingCaregiver] = useState<Caregiver | undefined>();

  const { data: caregivers = [], isLoading } = useCaregivers();
  const deactivateCaregiver = useDeactivateCaregiver();
  const updateCaregiver = useUpdateCaregiver();

  // Filter caregivers based on showAll toggle
  const filteredCaregivers = useMemo(() => {
    if (showAll) {
      return caregivers;
    }
    return caregivers.filter((c) => c.is_active);
  }, [caregivers, showAll]);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const handleEdit = (caregiver: Caregiver) => {
    setEditingCaregiver(caregiver);
    setDialogOpen(true);
  };

  const handleDeactivateClick = (caregiver: Caregiver) => {
    setDeactivatingCaregiver(caregiver);
    setDeactivateDialogOpen(true);
  };

  const handleDeactivate = async () => {
    if (deactivatingCaregiver) {
      try {
        await deactivateCaregiver.mutateAsync(deactivatingCaregiver.id);
        setDeactivateDialogOpen(false);
        setDeactivatingCaregiver(undefined);
      } catch (error) {
        console.error('Failed to deactivate caregiver:', error);
      }
    }
  };

  const handleReactivate = async (caregiver: Caregiver) => {
    try {
      await updateCaregiver.mutateAsync({
        id: caregiver.id,
        data: { is_active: true },
      });
    } catch (error) {
      console.error('Failed to reactivate caregiver:', error);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingCaregiver(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Caregivers</h2>
        <div className="flex items-center gap-4">
          {/* Show Active / Show All Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={showAll ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowAll(false)}
            >
              Active Only
            </Button>
            <Button
              variant={showAll ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAll(true)}
            >
              Show All
            </Button>
          </div>

          {/* Add Caregiver Button */}
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              if (!open) handleDialogClose();
              else setDialogOpen(true);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Caregiver
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCaregiver ? 'Edit Caregiver' : 'Add Caregiver'}
                </DialogTitle>
              </DialogHeader>
              <CaregiverDialog
                caregiver={editingCaregiver}
                onClose={handleDialogClose}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Caregivers List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      ) : filteredCaregivers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>No caregivers found.</p>
            <p className="text-sm">Click "Add Caregiver" to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCaregivers.map((caregiver) => (
            <Card key={caregiver.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{caregiver.name}</CardTitle>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      caregiver.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {caregiver.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Default Hourly Rate
                </div>
                <div className="text-2xl font-semibold">
                  {formatCurrency(caregiver.default_hourly_rate)}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(caregiver)}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
                {caregiver.is_active ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeactivateClick(caregiver)}
                  >
                    <UserX className="mr-1 h-4 w-4" />
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReactivate(caregiver)}
                    disabled={updateCaregiver.isPending}
                  >
                    <UserCheck className="mr-1 h-4 w-4" />
                    Reactivate
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Caregiver</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to deactivate{' '}
            <strong>{deactivatingCaregiver?.name}</strong>? They will no longer
            appear in active caregiver lists, but their time entries and history
            will be preserved.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivateCaregiver.isPending}
            >
              {deactivateCaregiver.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Caregivers;
