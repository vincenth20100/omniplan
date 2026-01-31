'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ColumnSpec, View } from "@/lib/types";
import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, ChevronsUp, ChevronsDown } from "lucide-react";
import { ViewManager } from "./view-manager";
import { Separator } from "../ui/separator";

export function GroupingDialog({
    open,
    onOpenChange,
    grouping,
    columns,
    dispatch,
    views,
    currentViewId,
    isDirty,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    grouping: string[];
    columns: ColumnSpec[];
    dispatch: any;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
}) {
    const [currentGrouping, setCurrentGrouping] = useState<string[]>([]);
    const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null);
    const [selectedGroupBy, setSelectedGroupBy] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setCurrentGrouping(grouping);
        }
    }, [open, grouping]);
    
    // This effect is needed to react to changes from the ViewManager inside the dialog
    useEffect(() => {
        if (open) {
            setCurrentGrouping(grouping);
        }
    }, [grouping, open]);

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
        dispatch({ type: 'SET_GROUPING', payload: currentGrouping });
        onOpenChange(false);
    };

    const handleClear = () => {
        setCurrentGrouping([]);
    };

    const renderFieldList = (fields: ColumnSpec[], selected: string | null, onSelect: (id: string) => void) => (
        <div className="border rounded-md h-40 sm:h-64 overflow-y-auto">
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Group By</DialogTitle>
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
                
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-4 items-center overflow-y-auto max-h-[60vh] p-1">
                    {/* Available Fields */}
                    <div className="flex flex-col gap-2">
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
                    <div className="flex flex-col gap-2">
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
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleSave}>OK</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
