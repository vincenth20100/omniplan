'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, parse, isValid } from 'date-fns';
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
    isEditing: isEditingProp,
    onStopEditing,
    initialValue,
}: {
    value: Date | null | undefined;
    onSave: (newValue: Date | null) => void;
    className?: string;
    calendar: CalendarType | null;
    dateFormat?: string;
    isEditing?: boolean;
    onStopEditing?: () => void;
    initialValue?: string;
}) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Update input value when the external date `value` changes and we are not editing
        if (!isEditingProp) {
            setInputValue(value ? format(value, dateFormat) : '');
        }
    }, [value, dateFormat, isEditingProp]);
    
    useEffect(() => {
        if (isEditingProp) {
            setInputValue(initialValue !== undefined ? initialValue : (value ? format(value, dateFormat) : ''));
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [isEditingProp, initialValue, value, dateFormat]);
    
    const stopEditing = useCallback(() => {
        if (onStopEditing) {
            onStopEditing();
        }
    }, [onStopEditing]);

    const handleSaveFromPicker = (date: Date | undefined | null) => {
        setPopoverOpen(false);
        const newDate = date || null;
        const oldTime = value?.getTime();
        const newTime = newDate?.getTime();
        if (oldTime !== newTime) {
            onSave(newDate);
        }
        stopEditing();
    };

    const commitChanges = useCallback(() => {
        const currentInputValue = inputRef.current?.value ?? '';
        
        if (currentInputValue === (value ? format(value, dateFormat) : '')) {
            return;
        }

        if (currentInputValue.trim() === '') {
            onSave(null);
            return;
        }

        const parsedDate = parse(currentInputValue, dateFormat, new Date());
        
        if (isValid(parsedDate)) {
            const oldTime = value?.getTime();
            const newTime = parsedDate?.getTime();
            if (oldTime !== newTime) {
                onSave(parsedDate);
            }
        }
    }, [value, dateFormat, onSave]);

    const handleInputBlur = useCallback(() => {
        commitChanges();
        if (!popoverOpen) {
            stopEditing();
        }
    }, [commitChanges, popoverOpen, stopEditing]);


    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setPopoverOpen(false);
            commitChanges();
            stopEditing();
        } else if (e.key === 'Escape') {
             e.preventDefault();
             setPopoverOpen(false);
             stopEditing();
        }
    };
    
    useEffect(() => {
        if (!isEditingProp) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                inputRef.current && 
                !inputRef.current.contains(target) &&
                !document.querySelector('[data-radix-popper-content-wrapper]')?.contains(target)
            ) {
                 event.preventDefault();
                 event.stopPropagation();
                 commitChanges();
                 stopEditing();
            }
        };
        
        const timer = setTimeout(() => {
             document.addEventListener('pointerdown', handlePointerDown, true);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('pointerdown', handlePointerDown, true);
        };
    }, [isEditingProp, commitChanges, stopEditing]);

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
        <Popover open={popoverOpen} onOpenChange={(open) => {
            setPopoverOpen(open);
            if (!open) {
                // If popover closes, ensure editing stops if input isn't focused
                setTimeout(() => {
                    if (document.activeElement !== inputRef.current) {
                        stopEditing();
                    }
                }, 0);
            }
        }}>
            <PopoverTrigger asChild>
                <div className={cn("relative w-full h-full flex items-center", className)}>
                    <Input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleInputBlur}
                        onKeyDown={handleInputKeyDown}
                        className="h-full p-0 pl-2 pr-2 border-transparent focus:border-input rounded-none bg-transparent focus:bg-card focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={value || undefined}
                    onSelect={handleSaveFromPicker}
                    modifiers={modifiers}
                    modifiersClassNames={modifiersClassNames}
                />
            </PopoverContent>
        </Popover>
    );
}
