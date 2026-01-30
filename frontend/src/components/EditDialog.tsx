"use client"

import * as React from "react"
import { useForm, type FieldValues, type DefaultValues, type Path, type Control, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

// ============================================================================
// Types
// ============================================================================

export type FieldType = "text" | "number" | "date" | "time" | "select" | "textarea" | "checkbox"

export interface FieldOption {
  value: string
  label: string
}

export interface FieldConfig {
  name: string
  label: string
  type: FieldType
  options?: FieldOption[]
  placeholder?: string
  step?: string
  min?: string
  max?: string
  required?: boolean
}

// Use a simplified type that works with react-hook-form
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodObjectSchema = z.ZodObject<any>

interface EditDialogProps<TFormValues extends FieldValues> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: FieldConfig[]
  schema: ZodObjectSchema
  defaultValues: TFormValues
  onSubmit: (values: TFormValues) => Promise<void>
  isLoading?: boolean
}

// ============================================================================
// EditDialog Component
// ============================================================================

export function EditDialog<TFormValues extends FieldValues>({
  open,
  onOpenChange,
  title,
  fields,
  schema,
  defaultValues,
  onSubmit,
  isLoading = false,
}: EditDialogProps<TFormValues>) {
  // Use FieldValues as the base type to avoid complex generic issues
  const form = useForm<FieldValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues as DefaultValues<FieldValues>,
  })

  // Reset form when dialog opens with new default values
  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues as DefaultValues<FieldValues>)
    }
  }, [open, defaultValues, form])

  const handleSubmit: SubmitHandler<FieldValues> = async (values) => {
    try {
      await onSubmit(values as TFormValues)
      onOpenChange(false)
    } catch (error) {
      // Error is handled by parent component
      console.error("Failed to save:", error)
    }
  }

  const renderField = (fieldConfig: FieldConfig) => {
    const fieldName = fieldConfig.name as Path<FieldValues>
    const control = form.control as Control<FieldValues>

    switch (fieldConfig.type) {
      case "select":
        return (
          <FormField
            key={fieldConfig.name}
            control={control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fieldConfig.label}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value as string}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={fieldConfig.placeholder || `Select ${fieldConfig.label.toLowerCase()}`} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {fieldConfig.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case "textarea":
        return (
          <FormField
            key={fieldConfig.name}
            control={control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fieldConfig.label}</FormLabel>
                <FormControl>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={fieldConfig.placeholder}
                    {...field}
                    value={(field.value as string) || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )

      case "checkbox":
        return (
          <FormField
            key={fieldConfig.name}
            control={control}
            name={fieldName}
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value as boolean}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>{fieldConfig.label}</FormLabel>
                </div>
              </FormItem>
            )}
          />
        )

      default:
        return (
          <FormField
            key={fieldConfig.name}
            control={control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{fieldConfig.label}</FormLabel>
                <FormControl>
                  <Input
                    type={fieldConfig.type}
                    placeholder={fieldConfig.placeholder}
                    step={fieldConfig.step}
                    min={fieldConfig.min}
                    max={fieldConfig.max}
                    {...field}
                    value={(field.value as string) || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {fields.map(renderField)}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default EditDialog
