'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function EditableSelectCell({
    value,
    onSave,
    options,
    placeholder
}: {
    value: string | null;
    onSave: (newValue: string | null) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
}) {

    const handleValueChange = (newValue: string) => {
        const valueToSave = newValue === 'none' ? null : newValue;
        if (valueToSave !== value) {
            onSave(valueToSave);
        }
    }

    return (
        <Select
            value={value || 'none'}
            onValueChange={handleValueChange}
        >
            <SelectTrigger className="h-8 p-1 w-full text-xs" onClick={(e) => e.stopPropagation()}>
                <SelectValue placeholder={placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">
                    <span className="text-muted-foreground">{placeholder || "None"}</span>
                </SelectItem>
                {options.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
