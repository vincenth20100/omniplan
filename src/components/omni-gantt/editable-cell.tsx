'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function EditableCell({
    value,
    onSave,
    className,
    isEditing: isEditingProp, // To be able to control from outside
    onStopEditing: onStopEditingProp, // To be able to control from outside
    initialValue,
    inputClassName,
}: {
    value: string;
    onSave: (newValue: string) => void;
    className?: string;
    isEditing?: boolean; // now optional
    onStopEditing?: () => void; // now optional
    initialValue?: string;
    inputClassName?: string;
}) {
    const [internalIsEditing, setInternalIsEditing] = useState(false);
    const isControlled = isEditingProp !== undefined;
    const isEditing = isControlled ? isEditingProp : internalIsEditing;

    const [currentValue, setCurrentValue] = useState(value);
    const currentValueRef = useRef(currentValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasSavedOnBlur = useRef(false);

    useEffect(() => {
        if (isEditing) {
            hasSavedOnBlur.current = false;
            const newValue = initialValue !== undefined ? initialValue : value;
            setCurrentValue(newValue);
            currentValueRef.current = newValue;
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

    const prevIsEditing = useRef(isEditing);

    useEffect(() => {
        if (prevIsEditing.current && !isEditing) {
            // Check if we need to save when transitioning from editing to not editing
            // This is a fallback for when blur doesn't fire (e.g. mobile tap outside or component unmount)
            if (!hasSavedOnBlur.current && currentValueRef.current !== value) {
                onSave(currentValueRef.current);
            }
        }
        prevIsEditing.current = isEditing;
    }, [isEditing, value, onSave]);


    const handleBlur = useCallback(() => {
        // Use currentValueRef to get the latest value without relying on the input element
        // which might be unmounting or unavailable.
        if (currentValueRef.current !== value) {
            onSave(currentValueRef.current);
            hasSavedOnBlur.current = true;
        }
        if (isControlled) {
            onStopEditingProp?.();
        } else {
            setInternalIsEditing(false);
        }
    }, [value, onSave, isControlled, onStopEditingProp]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            // To prevent saving on escape, reset the input's value before blurring
            const originalValue = value;
            setCurrentValue(originalValue);
            currentValueRef.current = originalValue;

            if (inputRef.current) {
                inputRef.current.value = originalValue;
            }
            (e.target as HTMLInputElement).blur();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setCurrentValue(newValue);
        currentValueRef.current = newValue;
    };

    return (
        <div className={cn("w-full h-full flex items-center cursor-text", className)} onClick={() => !isControlled && !internalIsEditing && setInternalIsEditing(true)}>
             {isEditing ? (
                <Input
                    ref={inputRef}
                    type="text"
                    value={currentValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className={cn("h-full p-0 border-transparent focus:border-input rounded-none bg-transparent focus:bg-card focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring", inputClassName || className)}
                />
            ) : (
                <div className="w-full h-full flex items-center">
                    {value}
                </div>
            )}
        </div>
    );
}
