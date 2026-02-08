import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoomSelectorProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const PRESETS = [0.25, 0.5, 0.75, 1, 1.5];

export function ZoomSelector({ value, onValueChange, min = 0.1, max = 5, disabled }: ZoomSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  // Update input value when popover opens
  React.useEffect(() => {
    if (open) {
      setInputValue(Math.round(value * 100).toString());
    }
  }, [open, value]);

  const displayValue = Math.round(value * 100) + '%';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          parseAndSetZoom(inputValue);
      }
  };

  const handleInputBlur = () => {
      // If the popover is closing because user clicked outside, we might want to just let it close without change,
      // or commit the value. Usually commit on Enter is safer, but let's see.
      // Actually, if we commit on blur, it might conflict with clicking a preset button.
      // So let's only commit on Enter for now.
      // Or we can check relatedTarget.
      // For simplicity, let's stick to Enter.
  };

  const parseAndSetZoom = (val: string) => {
      let num = parseFloat(val.replace('%', ''));
      if (isNaN(num)) return;

      let newZoom = num / 100; // Convert to decimal
      if (newZoom < min) newZoom = min;
      if (newZoom > max) newZoom = max;

      onValueChange(newZoom);
      setOpen(false);
  };

  return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-[90px] justify-between px-2 h-8", !value && "text-muted-foreground")}
            disabled={disabled}
            title="Select Zoom Level"
          >
            {displayValue}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[120px] p-0" align="start">
           <div className="p-2 border-b">
               <div className="relative">
                   <Input
                       className="h-8 pr-6"
                       placeholder="Custom"
                       value={inputValue}
                       onChange={handleInputChange}
                       onKeyDown={handleInputKeyDown}
                       autoFocus
                   />
                   <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">%</span>
               </div>
           </div>
           <div className="p-1 grid gap-0.5">
               {PRESETS.map((preset) => (
                   <Button
                       key={preset}
                       variant="ghost"
                       className={cn("justify-between font-normal h-8 px-2 w-full", Math.abs(value - preset) < 0.001 && "bg-accent")}
                       onClick={() => { onValueChange(preset); setOpen(false); }}
                   >
                       {Math.round(preset * 100)}%
                       {Math.abs(value - preset) < 0.001 && <Check className="h-3 w-3" />}
                   </Button>
               ))}
           </div>
        </PopoverContent>
      </Popover>
  );
}
