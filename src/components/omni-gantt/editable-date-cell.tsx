'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Calendar as CalendarType } from '@/lib/types';
import { calendarService } from '@/lib/calendar';

export function EditableDateCell({
    value,
    onSave,
    className,
    calendar,
}: {
    value: Date | null | undefined;
    onSave: (newValue: Date | null) => void;
    className?: string;
    calendar: CalendarType | null;
}) {
    const [popoverOpen, setPopoverOpen] = useState(false);

    const handleSave = (date: Date | undefined | null) => {
        setPopoverOpen(false);
        if (date?.getTime() !== value?.getTime()) {
            onSave(date || null);
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
            <PopoverTrigger asChild>
                 <div
                    role="button"
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setPopoverOpen(true);
                    }}
                    className={cn("w-full h-full flex items-center justify-between", className)}
                >
                    <span>{value ? format(value, 'MMM d, yyyy') : ''}</span>
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={value || undefined}
                    onSelect={(date) => handleSave(date)}
                    initialFocus
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                />
            </PopoverContent>
        </Popover>
    );
}
