import * as React from 'react';
import { Calculator, PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { decimalToHoursMinutes, parseHoursInput } from '@/lib/time-utils';

interface HoursInputProps {
  value: string;
  onChange: (decimal: string) => void;
  isAutoCalculated?: boolean;
  onManualEdit?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Smart input for hours that:
 * - Displays "Xh Ym" when not focused
 * - Accepts multiple formats when editing (12:30, 12h 30m, 12.5)
 * - Shows an indicator for auto-calculated vs manual
 */
export function HoursInput({
  value,
  onChange,
  isAutoCalculated = false,
  onManualEdit,
  disabled = false,
  className,
}: HoursInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync editValue when value prop changes (e.g., from auto-calculation)
  React.useEffect(() => {
    if (!isFocused) {
      setEditValue(value);
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setEditValue(value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseHoursInput(editValue);
    if (parsed && parsed !== value) {
      onChange(parsed);
      onManualEdit?.();
    }
    setEditValue(parsed || value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(value);
      setIsFocused(false);
    }
  };

  const displayValue = value ? decimalToHoursMinutes(value) : '';

  return (
    <div className={cn('relative', className)}>
      {isFocused ? (
        <Input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 12:30 or 12h 30m"
          disabled={disabled}
          className="h-8 pr-8"
          autoFocus
        />
      ) : (
        <div
          className={cn(
            'flex h-8 items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50',
          )}
          onClick={() => !disabled && inputRef.current?.focus()}
          onFocus={handleFocus}
          tabIndex={disabled ? -1 : 0}
          role="button"
        >
          <span>{displayValue || <span className="text-muted-foreground">Enter hours</span>}</span>
          {value && (
            <span className="text-muted-foreground" title={isAutoCalculated ? 'Auto-calculated from times' : 'Manually entered'}>
              {isAutoCalculated ? (
                <Calculator className="h-3.5 w-3.5" />
              ) : (
                <PencilLine className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
