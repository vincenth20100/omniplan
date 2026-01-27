'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function EditableCell({
    value,
    onSave,
    className,
    isEditing,
    onStopEditing,
    initialValue,
}: {
    value: string;
    onSave: (newValue: string) => void;
    className?: string;
    isEditing: boolean;
    onStopEditing: () => void;
    initialValue?: string;
}) {
    const [currentValue, setCurrentValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            setCurrentValue(initialValue !== undefined ? initialValue : value);
        }
    }, [isEditing, initialValue, value]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            if (initialValue !== undefined && initialValue !== '') {
                 setTimeout(() => {
                    if(inputRef.current) {
                        inputRef.current.selectionStart = inputRef.current.selectionEnd = inputRef.current.value.length;
                    }
                }, 0);
            } else {
                inputRef.current?.select();
            }
        }
    }, [isEditing, initialValue]);


    const handleBlur = () => {
        if (currentValue !== value) {
            onSave(currentValue);
        }
        onStopEditing();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setCurrentValue(value);
            onStopEditing();
        }
    };

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                type="text"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={cn("h-full p-0 border-transparent focus:border-input rounded-none bg-transparent focus:bg-card focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring", className)}
            />
        );
    }

    return (
        <div className={cn("w-full h-full flex items-center", className)}>
            {value}
        </div>
    );
}
