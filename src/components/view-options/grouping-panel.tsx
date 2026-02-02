'use client';

import { Button } from "@/components/ui/button";
import type { ColumnSpec, View } from "@/lib/types";
import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronsUp, ChevronsDown } from "lucide-react";
import { Separator } from "../ui/separator";

export function GroupingPanel({
    grouping,
    columns,
    dispatch,
    views,
    currentViewId,
    isDirty,
    onApply,
    onCancel,
}: {
    grouping: string[];
    columns: ColumnSpec[];
    dispatch: any;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
    onApply: (grouping: string[]) => void;
    onCancel: () => void;
}) {
    const [currentGrouping, setCurrentGrouping] = useState<string[]>([]);
    const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null);
    const [selectedGroupBy, setSelectedGroupBy] = useState<string | null>(null);

    useEffect(() => {
        setCurrentGrouping(grouping);
    }, [grouping]);

    const groupableColumns = columns.filter(c => !['wbs', 'name', 'predecessors', 'successors'].includes(c.id));

    const availableFields = groupableColumns.filter(c => !currentGrouping.includes(c.id));
    const groupByFields = currentGrouping.map(id => columns.find(c => c.id === id)).filter(Boolean) as ColumnSpec[];

    const handleAddField = () => {
        if (selectedAvailable) {
            setCurrentGrouping([...currentGrouping, selectedAvailable]);
            setSelectedAvailable(null);
        }
    };

    const handleRemoveField = () => {
        if (selectedGroupBy) {
            setCurrentGrouping(currentGrouping.filter(id => id !== selectedGroupBy));
            setSelectedGroupBy(null);
        }
    };

    const handleMoveUp = () => {
        if (!selectedGroupBy) return;
        const index = currentGrouping.indexOf(selectedGroupBy);
        if (index > 0) {
            const newGrouping = [...currentGrouping];
            [newGrouping[index - 1], newGrouping[index]] = [newGrouping[index], newGrouping[index-1]];
            setCurrentGrouping(newGrouping);
        }
    };

    const handleMoveDown = () => {
        if (!selectedGroupBy) return;
        const index = currentGrouping.indexOf(selectedGroupBy);
        if (index < currentGrouping.length - 1) {
            const newGrouping = [...currentGrouping];
            [newGrouping[index], newGrouping[index + 1]] = [newGrouping[index + 1], newGrouping[index]];
            setCurrentGrouping(newGrouping);
        }
    };

    const handleSave = () => {
        onApply(currentGrouping);
    };

    const handleClear = () => {
        setCurrentGrouping([]);
    };

    const renderFieldList = (fields: ColumnSpec[], selected: string | null, onSelect: (id: string) => void) => (
        <div className="border rounded-md flex-1 min-h-[10rem] sm:h-64 sm:flex-none overflow-y-auto">
            {fields.map(field => (
                <div
                    key={field.id}
                    className={`p-2 cursor-pointer ${selected === field.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'}`}
                    onClick={() => onSelect(field.id)}
                >
                    {field.name}
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr_auto] gap-4 items-stretch sm:items-center overflow-hidden flex-1 p-1">
                {/* Available Fields */}
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <h3 className="font-semibold text-sm">Available fields:</h3>
                    {renderFieldList(availableFields, selectedAvailable, setSelectedAvailable)}
                </div>

                {/* Add/Remove Buttons */}
                <div className="flex flex-row justify-center sm:flex-col gap-2">
                    <Button variant="outline" size="icon" onClick={handleAddField} disabled={!selectedAvailable}>
                        <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleRemoveField} disabled={!selectedGroupBy}>
                        <ArrowLeft className="h-4 w-4 rotate-90 sm:rotate-0" />
                    </Button>
                </div>

                {/* Group By Fields */}
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm">Group by:</h3>
                        <Button variant="link" size="sm" onClick={handleClear} className="h-auto p-0">Clear All</Button>
                    </div>
                    {renderFieldList(groupByFields, selectedGroupBy, setSelectedGroupBy)}
                </div>

                {/* Move Buttons */}
                <div className="flex flex-row justify-center sm:flex-col gap-2">
                        <Button variant="outline" size="icon" onClick={handleMoveUp} disabled={!selectedGroupBy || currentGrouping.indexOf(selectedGroupBy) === 0}>
                        <ChevronsUp className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleMoveDown} disabled={!selectedGroupBy || currentGrouping.indexOf(selectedGroupBy) === currentGrouping.length - 1}>
                        <ChevronsDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4 justify-end">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="button" onClick={handleSave}>OK</Button>
            </div>
        </div>
    );
}
