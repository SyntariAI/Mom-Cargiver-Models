"use client"

import * as React from "react"
import { ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
  emptyMessage?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  className,
  emptyMessage = "No options found.",
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label)

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([])
    } else {
      onChange(options.map((o) => o.value))
    }
  }

  const displayValue = () => {
    if (selectedLabels.length === 0) {
      return placeholder
    }
    if (selectedLabels.length === 1) {
      return selectedLabels[0]
    }
    if (selectedLabels.length === options.length) {
      return "All selected"
    }
    return `${selectedLabels.length} selected`
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn(
            "w-[200px] justify-between",
            !value.length && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayValue()}</span>
          <div className="flex items-center gap-1 ml-2">
            {value.length > 0 && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100 shrink-0"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        {options.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            {emptyMessage}
          </div>
        ) : (
          <div className="p-1">
            {/* Select All option */}
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer",
                "hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={handleSelectAll}
            >
              <Checkbox
                checked={value.length === options.length}
                className="pointer-events-none"
              />
              <span className="font-medium">Select All</span>
            </div>
            <div className="h-px bg-muted my-1" />
            {/* Options */}
            <div className="max-h-[200px] overflow-y-auto">
              {options.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer",
                    "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Checkbox
                    checked={value.includes(option.value)}
                    className="pointer-events-none"
                  />
                  <span>{option.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
