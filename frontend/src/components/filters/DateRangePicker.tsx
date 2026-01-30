"use client"

import * as React from "react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DateRangeValue {
  from: Date | undefined
  to: Date | undefined
}

interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  placeholder?: string
  className?: string
}

type PresetKey = "this-week" | "last-week" | "last-2-weeks" | "this-month" | "last-month"

interface Preset {
  label: string
  getValue: () => DateRange
}

const presets: Record<PresetKey, Preset> = {
  "this-week": {
    label: "This week",
    getValue: () => {
      const now = new Date()
      return {
        from: startOfWeek(now, { weekStartsOn: 0 }),
        to: endOfWeek(now, { weekStartsOn: 0 }),
      }
    },
  },
  "last-week": {
    label: "Last week",
    getValue: () => {
      const lastWeek = subWeeks(new Date(), 1)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 0 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 0 }),
      }
    },
  },
  "last-2-weeks": {
    label: "Last 2 weeks",
    getValue: () => {
      const now = new Date()
      return {
        from: subDays(now, 14),
        to: now,
      }
    },
  },
  "this-month": {
    label: "This month",
    getValue: () => {
      const now = new Date()
      return {
        from: startOfMonth(now),
        to: endOfMonth(now),
      }
    },
  },
  "last-month": {
    label: "Last month",
    getValue: () => {
      const lastMonth = subDays(startOfMonth(new Date()), 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      }
    },
  },
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handlePresetClick = (presetKey: PresetKey) => {
    const preset = presets[presetKey]
    const range = preset.getValue()
    onChange({ from: range.from, to: range.to })
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange({ from: undefined, to: undefined })
  }

  const formatDateRange = () => {
    if (value.from) {
      if (value.to) {
        return `${format(value.from, "MMM d, yyyy")} - ${format(value.to, "MMM d, yyyy")}`
      }
      return format(value.from, "MMM d, yyyy")
    }
    return placeholder
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{formatDateRange()}</span>
          {value.from && (
            <X
              className="ml-2 h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="border-r p-2 space-y-1">
            <div className="px-2 py-1.5 text-sm font-semibold">Presets</div>
            {(Object.keys(presets) as PresetKey[]).map((key) => (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handlePresetClick(key)}
              >
                {presets[key].label}
              </Button>
            ))}
          </div>
          {/* Calendar */}
          <div className="p-2">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={value.from}
              selected={{ from: value.from, to: value.to }}
              onSelect={(range) => {
                onChange({ from: range?.from, to: range?.to })
              }}
              numberOfMonths={2}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
