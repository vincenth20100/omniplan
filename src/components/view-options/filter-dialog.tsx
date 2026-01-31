'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ColumnSpec, Filter as FilterType, View } from "@/lib/types";
import { useState, useEffect } from 'react';
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EditableDateCell } from "../omni-gantt/editable-date-cell";
import { ViewManager } from "./view-manager";
import { Separator } from "../ui/separator";

type Operator =
  | 'none'
  | 'contains' | 'not_contains'
  | 'equals' | 'not_equals'
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'is_empty' | 'is_not_empty';

const OPERATORS: { [key in ColumnSpec['type'] | 'default' | 'date']: { value: Operator; label: string }[] } = {
  text: [
    { value: 'none', label: 'None' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'none', label: 'None' },
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '!=' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '>=' },
    { value: 'lte', label: '<=' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  date: [
    { value: 'none', label: 'None' },
    { value: 'equals', label: 'is on' },
    { value: 'not_equals', label: 'is not on' },
    { value: 'gt', label: 'is after' },
    { value: 'lt', label: 'is before' },
    { value: 'gte', label: 'is on or after' },
    { value: 'lte', label: 'is on or before' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  selection: [
    { value: 'none', label: 'None' },
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
  default: [
    { value: 'none', label: 'None' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
};


export function FilterDialog({
    open,
    onOpenChange,
    filters,
    columns,
    dispatch,
    views,
    currentViewId,
    isDirty,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: FilterType[];
    columns: ColumnSpec[];
    dispatch: any;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
}) {
    const [currentFilters, setCurrentFilters] = useState<FilterType[]>([]);

    useEffect(() => {
        if (open) {
            setCurrentFilters(filters);
        }
    }, [open, filters]);

    // This effect is needed to react to changes from the ViewManager inside the dialog
    useEffect(() => {
        if (open) {
            setCurrentFilters(filters);
        }
    }, [filters, open]);

    const handleAddFilter = () => {
        const firstColumn = columns.find(c => c.id !== 'wbs');
        if (!firstColumn) return;
        const newFilter: FilterType = {
            id: `filter-${Date.now()}`,
            columnId: firstColumn.id,
            operator: 'none',
            value: ''
        };
        setCurrentFilters([...currentFilters, newFilter]);
    };

    const handleUpdateFilter = (id: string, updates: Partial<FilterType>) => {
        setCurrentFilters(currentFilters.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleRemoveFilter = (id: string) => {
        setCurrentFilters(currentFilters.filter(f => f.id !== id));
    };
    
    const handleApply = () => {
        dispatch({ type: 'SET_FILTERS', payload: currentFilters.filter(f => f.operator !== 'none') });
        onOpenChange(false);
    };
    
    const renderFilterValueInput = (filter: FilterType) => {
        const column = columns.find(c => c.id === filter.columnId);
        if (!column || filter.operator === 'is_empty' || filter.operator === 'is_not_empty' || filter.operator === 'none') {
            return <div className="w-full sm:w-[180px]" />;
        }
        
        let columnType = column.type;
        if (['start', 'finish', 'constraintDate'].includes(column.id)) {
            columnType = 'date';
        }
        
        if (columnType === 'date') {
             return (
                <div className="w-full sm:w-[180px]">
                    <EditableDateCell
                        value={filter.value ? new Date(filter.value) : null}
                        onSave={(newValue) => handleUpdateFilter(filter.id, { value: newValue?.toISOString() || '' })}
                        calendar={null}
                    />
                </div>
            )
        }
        
        if (column?.type === 'selection' && column.options) {
            return (
                 <Select value={filter.value} onValueChange={(value) => handleUpdateFilter(filter.id, { value })}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select a value" />
                    </SelectTrigger>
                    <SelectContent>
                        {column.options.map(opt => (
                             <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        return (
            <Input 
                value={filter.value}
                onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                className="w-full sm:w-[180px]"
                type={column?.type === 'number' ? 'number' : 'text'}
            />
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Filter Tasks</DialogTitle>
                </DialogHeader>

                <div className="border rounded-lg p-4">
                    <ViewManager 
                        views={views}
                        currentViewId={currentViewId}
                        isDirty={isDirty}
                        dispatch={dispatch}
                        showTitle={false}
                    />
                </div>

                <Separator />
                
                <div className="space-y-2">
                    <p className="text-sm">Show items with matching conditions:</p>
                    {currentFilters.map((filter) => {
                        const column = columns.find(c => c.id === filter.columnId);
                        
                        let columnType = column?.type;
                        if (['start', 'finish', 'constraintDate'].includes(filter.columnId)) {
                            columnType = 'date';
                        }
                        const operatorSet = OPERATORS[columnType || 'default'];
                        
                        return (
                            <div key={filter.id} className="flex flex-col items-stretch sm:flex-row sm:items-center gap-2">
                                <Select value={filter.columnId} onValueChange={(columnId) => {
                                    const newCol = columns.find(c=>c.id===columnId);
                                    let newColType = newCol?.type;
                                    if (['start', 'finish', 'constraintDate'].includes(newCol?.id || '')) {
                                        newColType = 'date';
                                    }
                                    handleUpdateFilter(filter.id, { columnId, operator: OPERATORS[newColType || 'default'][0].value, value: '' })
                                }}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Select column" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {columns.filter(c => c.id !== 'wbs').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={filter.operator} onValueChange={(operator: Operator) => handleUpdateFilter(filter.id, { operator })}>
                                    <SelectTrigger className="w-full sm:w-[150px]">
                                        <SelectValue placeholder="Select operator" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {operatorSet.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {renderFilterValueInput(filter)}
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveFilter(filter.id)} className="self-end sm:self-auto">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    })}
                     <Button variant="outline" size="sm" onClick={handleAddFilter}>
                        <Plus className="mr-2 h-4 w-4" /> Add filter
                    </Button>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleApply}>Apply</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
