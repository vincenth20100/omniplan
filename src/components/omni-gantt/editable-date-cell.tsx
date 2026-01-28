'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { format, parse, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import type { Calendar as CalendarType } from '@/lib/types';
import { calendarService } from '@/lib/calendar';

export function EditableDateCell({
    value,
    onSave,
    className,
    calendar,
    dateFormat = 'MMM d, yyyy',
}: {
    value: Date | null | undefined;
    onSave: (newValue: Date | null) => void;
    className?: string;
    calendar: CalendarType | null;
    dateFormat?: string;
}) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        // Update input value when the external date `value` changes
        setInputValue(value ? format(value, dateFormat) : '');
    }, [value, dateFormat]);

    const handleSaveFromPicker = (date: Date | undefined | null) => {
        setPopoverOpen(false);
        const newDate = date || null;
        const oldTime = value?.getTime();
        const newTime = newDate?.getTime();
        if (oldTime !== newTime) {
            onSave(newDate);
        }
        // No need to setInputValue here, useEffect will do it.
    };

    const tryParseAndSave = () => {
        if (inputValue === (value ? format(value, dateFormat) : '')) {
            return; // No change
        }

        if (inputValue.trim() === '') {
            onSave(null);
            return;
        }

        // Use the specified dateFormat for parsing
        const parsedDate = parse(inputValue, dateFormat, new Date());
        
        if (isValid(parsedDate)) {
            const oldTime = value?.getTime();
            const newTime = parsedDate?.getTime();
            if (oldTime !== newTime) {
                onSave(parsedDate);
            } else {
                 // Even if time is same, format might have changed, so we reset input
                 if(value) setInputValue(format(value, dateFormat));
            }
        } else {
            // Invalid date typed, revert to original value
            setInputValue(value ? format(value, dateFormat) : '');
        }
    }

    const handleInputBlur = () => {
        tryParseAndSave();
    };
    
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            tryParseAndSave();
            (e.target as HTMLInputElement).blur(); // Remove focus
        } else if (e.key === 'Escape') {
             setInputValue(value ? format(value, dateFormat) : '');
             (e.target as HTMLInputElement).blur();
        }
    };

    const modifiers = useMemo(() => {
        if (!calendar) return {};
        return {
            nonworking: (date: Date) => !calendarService.isWorkingDay(date, calendar),
        };
    }, [calendar]);

    const modifiersClassNames = {
        nonworking: 'text-muted-foreground opacity-70',
    };
    
    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <div className={cn("relative w-full h-full flex items-center", className)}>
                <Input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={handleInputBlur}
                    onKeyDown={handleInputKeyDown}
                    className="h-full p-0 pl-2 pr-8 border-transparent focus:border-input rounded-none bg-transparent focus:bg-card focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring"
                />
                <PopoverTrigger asChild>
                    <button
                        tabIndex={-1} // prevent tabbing to it
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                        aria-label="Open calendar"
                    >
                        <CalendarIcon className="h-4 w-4" />
                    </button>
                </PopoverTrigger>
            </div>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={value || undefined}
                    onSelect={handleSaveFromPicker}
                    initialFocus
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                />
            </PopoverContent>
        </Popover>
    );
}
