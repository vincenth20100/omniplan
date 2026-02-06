'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import type { TooltipFieldSetting } from "@/lib/types";
import { Plus, Trash2, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface TooltipConfigPanelProps {
    config: TooltipFieldSetting[];
    options: { id: string; label: string }[];
    onChange: (config: TooltipFieldSetting[]) => void;
    disabled?: boolean;
    labelBeforeField?: boolean;
}

export function TooltipConfigPanel({ config, options, onChange, disabled, labelBeforeField }: TooltipConfigPanelProps) {
    const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

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

    const relatedFieldsOptions = [
        { id: 'id', label: 'ID' },
        { id: 'name', label: 'Name' },
        { id: 'start', label: 'Start Date' },
        { id: 'finish', label: 'Finish Date' },
    ];

    return (
        <div className="space-y-2">
            {config.map((item) => {
                const fieldSelector = (
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
                );

                const labelInput = (
                    <Input
                        value={item.label}
                        onChange={(e) => handleUpdateLine(item.id, { label: e.target.value })}
                        className="flex-1"
                        placeholder="Label"
                        disabled={disabled}
                    />
                );

                return (
                    <div key={item.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-2" title="Display on same line as previous field">
                             <Checkbox
                                checked={!!item.displayInline}
                                onCheckedChange={(checked) => handleUpdateLine(item.id, { displayInline: !!checked })}
                                disabled={disabled}
                            />
                        </div>
                        {item.displayInline && (
                             <Input
                                value={item.inlineSeparator || ''}
                                onChange={(e) => handleUpdateLine(item.id, { inlineSeparator: e.target.value })}
                                className="w-16 h-9 px-2 text-center"
                                placeholder="Sep"
                                title="Separator character (e.g. - )"
                                disabled={disabled}
                            />
                        )}

                        {labelBeforeField ? (
                            <>
                                {labelInput}
                                {fieldSelector}
                            </>
                        ) : (
                            <>
                                {fieldSelector}
                                {labelInput}
                            </>
                        )}

                        {(item.field === 'predecessors' || item.field === 'successors') && (
                            <Popover
                                open={openPopoverId === item.id}
                                onOpenChange={(open) => setOpenPopoverId(open ? item.id : null)}
                               // modal={true}
                            >
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Configure Related Task Fields" disabled={disabled}>
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 z-[100]">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none mb-2">Displayed Fields</h4>
                                        <p className="text-xs text-muted-foreground mb-2">Select fields to display for each related task.</p>
                                        {relatedFieldsOptions.map(opt => (
                                            <div key={opt.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`related-${item.id}-${opt.id}`}
                                                    checked={(item.relatedTaskFields || (opt.id === 'name' ? ['name'] : [])).includes(opt.id)}
                                                    onCheckedChange={(checked) => {
                                                        // 1. Calculate the current state, resolving defaults immediately
                                                        const currentDefaults = opt.id === 'name' ? ['name'] : [];
                                                        const current = item.relatedTaskFields || currentDefaults;
                                                        // 2. Calculate next state
                                                        let next;
                                                        if (checked) {
                                                            next = [...current, opt.id];
                                                        } else {
                                                            next = current.filter(f => f !== opt.id);
                                                        }
                                                        // 3. Update
                                                        handleUpdateLine(item.id, { relatedTaskFields: next });

                                                    }}
                                                />
                                                <Label htmlFor={`related-${item.id}-${opt.id}`}>{opt.label}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveLine(item.id)}
                            disabled={disabled}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                );
            })}
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
