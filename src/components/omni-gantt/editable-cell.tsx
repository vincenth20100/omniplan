'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function EditableCell({
    value,
    onSave,
    className,
    isEditing: isEditingProp, // To be able to control from outside
    onStopEditing: onStopEditingProp, // To be able to control from outside
    initialValue,
}: {
    value: string;
    onSave: (newValue: string) => void;
    className?: string;
    isEditing?: boolean; // now optional
    onStopEditing?: () => void; // now optional
    initialValue?: string;
}) {
    const [internalIsEditing, setInternalIsEditing] = useState(false);
    const isControlled = isEditingProp !== undefined;
    const isEditing = isControlled ? isEditingProp : internalIsEditing;

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
        if (isControlled) {
            onStopEditingProp?.();
        } else {
            setInternalIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setCurrentValue(value);
            if (isControlled) {
                onStopEditingProp?.();
            } else {
                setInternalIsEditing(false);
            }
        }
    };

    return (
        <div className={cn("w-full h-full flex items-center cursor-text", className)} onClick={() => !isControlled && !internalIsEditing && setInternalIsEditing(true)}>
             {isEditing ? (
                <Input
                    ref={inputRef}
                    type="text"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className={cn("h-full p-0 border-transparent focus:border-input rounded-none bg-transparent focus:bg-card focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring", className)}
                />
            ) : (
                <div className="w-full h-full flex items-center">
                    {value}
                </div>
            )}
        </div>
    );
}
