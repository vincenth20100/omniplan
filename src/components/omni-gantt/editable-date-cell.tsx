'use client';

import React, { useState, useEffect } from 'react';
import { format, parse, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

export function EditableDateCell({
    value,
    onSave,
    className,
}: {
    value: Date | null | undefined;
    onSave: (newValue: Date | null) => void;
    className?: string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(value ? format(value, 'MMM d, yyyy') : '');
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        setInputValue(value ? format(value, 'MMM d, yyyy') : '');
    }, [value]);
    
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleSave = (date: Date | null) => {
        setIsEditing(false);
        setPopoverOpen(false);
        if (date?.getTime() !== value?.getTime()) {
            onSave(date);
        }
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setPopoverOpen(false);
        setInputValue(value ? format(value, 'MMM d, yyyy') : '');
    }

    const handleBlur = () => {
        const parsedDate = parse(inputValue, 'MMM d, yyyy', new Date());
        if (isValid(parsedDate)) {
            handleSave(parsedDate);
        } else if (inputValue === '') {
            handleSave(null);
        }
        else {
            handleCancel();
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };
    
    const handleDaySelect = (date: Date | undefined) => {
        if (date) {
            handleSave(date);
        }
    };

    if (isEditing) {
        return (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                 <div className="flex items-center w-full">
                    <Input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className={cn("h-8 p-1 w-full rounded-r-none", className)}
                    />
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            size="icon"
                            className="h-8 w-8 rounded-l-none border-l-0"
                            onClick={() => setPopoverOpen(true)}
                        >
                            <CalendarIcon className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                </div>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={isValid(parse(inputValue, 'MMM d, yyyy', new Date())) ? parse(inputValue, 'MMM d, yyyy', new Date()) : undefined}
                        onSelect={handleDaySelect}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <div onDoubleClick={handleDoubleClick} className={cn("w-full h-full", className)}>
            {value ? format(value, 'MMM d, yyyy') : ''}
        </div>
    );
}
