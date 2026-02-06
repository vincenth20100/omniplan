'use client';

import { Button } from "@/components/ui/button";
import type { TooltipFieldSetting } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface TooltipConfigPanelProps {
    config: TooltipFieldSetting[];
    options: { id: string; label: string }[];
    onChange: (config: TooltipFieldSetting[]) => void;
    disabled?: boolean;
}

export function TooltipConfigPanel({ config, options, onChange, disabled }: TooltipConfigPanelProps) {
    const handleAddLine = () => {
        const newSetting: TooltipFieldSetting = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            field: options[0]?.id || 'name',
            label: options[0]?.label || 'Name',
        };
        onChange([...config, newSetting]);
    };

    const handleUpdateLine = (id: string, updates: Partial<TooltipFieldSetting>) => {
        onChange(config.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const handleRemoveLine = (id: string) => {
        onChange(config.filter(item => item.id !== id));
    };

    const handleFieldChange = (id: string, field: string) => {
        const option = options.find(o => o.id === field);
        const currentItem = config.find(c => c.id === id);
        const oldOption = options.find(o => o.id === currentItem?.field);

        // Smart label update: if label matches the default label of the old field, update to new field's default
        let newLabel = currentItem?.label;
        if (currentItem && oldOption && currentItem.label === oldOption.label && option) {
            newLabel = option.label;
        } else if ((!newLabel || newLabel.trim() === '') && option) {
             newLabel = option.label;
        }

        handleUpdateLine(id, { field, label: newLabel });
    };

    return (
        <div className="space-y-2">
            {config.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                    <Select
                        value={item.field}
                        onValueChange={(value) => handleFieldChange(item.id, value)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        value={item.label}
                        onChange={(e) => handleUpdateLine(item.id, { label: e.target.value })}
                        className="flex-1"
                        placeholder="Label"
                        disabled={disabled}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveLine(item.id)}
                        disabled={disabled}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <Button
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                disabled={disabled}
            >
                <Plus className="mr-2 h-4 w-4" /> Add line
            </Button>
        </div>
    );
}
