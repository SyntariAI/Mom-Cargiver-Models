"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ============================================================================
// Types
// ============================================================================

export type EditableCellType = "text" | "number" | "date" | "time" | "select"

export interface SelectOption {
  value: string
  label: string
}

interface EditableCellProps {
  value: string
  displayValue?: string
  type?: EditableCellType
  options?: SelectOption[]
  onSave: (value: string) => Promise<void>
  placeholder?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
  step?: string
  min?: string
  max?: string
}

// ============================================================================
// Animation States
// ============================================================================

type AnimationState = "idle" | "loading" | "success" | "error"

// ============================================================================
// EditableCell Component
// ============================================================================

export function EditableCell({
  value,
  displayValue,
  type = "text",
  options = [],
  onSave,
  placeholder,
  className,
  inputClassName,
  disabled = false,
  step,
  min,
  max,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState(value)
  const [animationState, setAnimationState] = React.useState<AnimationState>("idle")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Reset edit value when value prop changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(value)
    }
  }, [value, isEditing])

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Handle click outside to save
  React.useEffect(() => {
    if (!isEditing) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleSave()
      }
    }

    // Small delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isEditing, editValue])

  const handleStartEditing = () => {
    if (disabled) return
    setIsEditing(true)
    setEditValue(value)
  }

  const handleSave = async () => {
    if (!isEditing) return

    // Don't save if value hasn't changed
    if (editValue === value) {
      setIsEditing(false)
      return
    }

    setAnimationState("loading")

    try {
      await onSave(editValue)
      setAnimationState("success")
      setIsEditing(false)
      // Reset animation state after animation completes
      setTimeout(() => setAnimationState("idle"), 600)
    } catch (error) {
      setAnimationState("error")
      // Reset to original value and close after shake animation
      setTimeout(() => {
        setEditValue(value)
        setAnimationState("idle")
        setIsEditing(false)
      }, 500)
    }
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
    setAnimationState("idle")
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault()
      handleSave()
    } else if (event.key === "Escape") {
      event.preventDefault()
      handleCancel()
    }
  }

  const handleSelectChange = async (newValue: string) => {
    setEditValue(newValue)

    // Auto-save on select change
    if (newValue !== value) {
      setAnimationState("loading")
      try {
        await onSave(newValue)
        setAnimationState("success")
        setIsEditing(false)
        setTimeout(() => setAnimationState("idle"), 600)
      } catch (error) {
        setAnimationState("error")
        setTimeout(() => {
          setEditValue(value)
          setAnimationState("idle")
          setIsEditing(false)
        }, 500)
      }
    } else {
      setIsEditing(false)
    }
  }

  // Animation classes
  const animationClasses = cn(
    "transition-all duration-200",
    animationState === "success" && "animate-flash-green",
    animationState === "error" && "animate-shake"
  )

  // Render loading state
  if (animationState === "loading") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Saving...</span>
      </div>
    )
  }

  // Render select dropdown
  if (isEditing && type === "select") {
    return (
      <div ref={containerRef} className={cn("min-w-[120px]", className)}>
        <Select
          value={editValue}
          onValueChange={handleSelectChange}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditing(false)
            }
          }}
        >
          <SelectTrigger className={cn("h-8", inputClassName)}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // Render text/number/date input
  if (isEditing) {
    return (
      <div ref={containerRef} className={className}>
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          className={cn("h-8 w-full", inputClassName)}
          step={step}
          min={min}
          max={max}
        />
      </div>
    )
  }

  // Render display value
  return (
    <div
      ref={containerRef}
      className={cn(
        "cursor-pointer rounded px-2 py-1 -mx-2 -my-1 hover:bg-muted/50",
        animationClasses,
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={handleStartEditing}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleStartEditing()
        }
      }}
    >
      {displayValue || value || (
        <span className="text-muted-foreground italic">{placeholder || "Click to edit"}</span>
      )}
    </div>
  )
}
