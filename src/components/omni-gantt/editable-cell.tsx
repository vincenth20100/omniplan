'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function EditableCell({
    value,
    onSave,
    className,
}: {
    value: string;
    onSave: (newValue: string) => void;
    className?: string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    const handleClick = (e: React.MouseEvent) => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (currentValue.trim() && currentValue !== value) {
            onSave(currentValue);
        } else {
            setCurrentValue(value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setCurrentValue(value);
        }
    };

    if (isEditing) {
        return (
            <Input
                type="text"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className={cn("h-8 p-1 w-full", className)}
            />
        );
    }

    return (
        <div onClick={handleClick} className={cn("w-full h-full flex items-center", className)}>
            {value}
        </div>
    );
}
