'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { ProjectState, Resource } from "@/lib/types";
import { EditableCell } from "@/components/omni-gantt/editable-cell";
import { EditableSelectCell } from "@/components/omni-gantt/editable-select-cell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import React, { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ResourceView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { resources } = projectState;
    const [groupBy, setGroupBy] = useState<string>('none');
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ targetId: string; position: 'top' | 'bottom' } | null>(null);

    const handleAddResource = () => {
        dispatch({ type: 'ADD_RESOURCE' });
    };

    const handleRemoveResource = (resourceId: string) => {
        dispatch({ type: 'REMOVE_RESOURCE', payload: { resourceId } });
    };

    const handleDragStart = (e: React.DragEvent, resourceId: string) => {
        if (groupBy !== 'none') {
            e.preventDefault();
            return;
        }
        setDraggedId(resourceId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, resourceId: string) => {
        e.preventDefault();
        if (groupBy !== 'none' || !draggedId || draggedId === resourceId) {
            setDropIndicator(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const position = y < rect.height / 2 ? 'top' : 'bottom';

        setDropIndicator({ targetId: resourceId, position });
    };

    const handleDragLeave = () => {
        setDropIndicator(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        if (groupBy !== 'none' || !draggedId || !dropIndicator) return;

        dispatch({
            type: 'REORDER_RESOURCE',
            payload: {
                sourceId: draggedId,
                targetId: dropIndicator.targetId,
                position: dropIndicator.position
            }
        });

        setDraggedId(null);
        setDropIndicator(null);
    };

    const resourceTypeOptions = [
        { value: 'Work', label: 'Work' },
        { value: 'Material', label: 'Material' },
        { value: 'Cost', label: 'Cost' },
    ];

    const sortedResources = useMemo(() => {
        return [...resources].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [resources]);

    const groupedResources = useMemo(() => {
        if (groupBy === 'none') {
            return { 'All': sortedResources };
        }

        const groups: Record<string, Resource[]> = {};
        sortedResources.forEach(r => {
             const key = (groupBy === 'category' ? r.category : r.type) || 'Uncategorized';
             if (!groups[key]) groups[key] = [];
             groups[key].push(r);
        });
        return groups;
    }, [sortedResources, groupBy]);
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 px-1">
                 <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Group by:</span>
                    <Select value={groupBy} onValueChange={setGroupBy}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="category">Category</SelectItem>
                            <SelectItem value="type">Type</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                <Button onClick={handleAddResource}>
                    <Plus className="mr-2 h-4 w-4" /> Add Resource
                </Button>
            </div>
            <div className="flex-grow">
                <ScrollArea className="h-[calc(80vh-150px)]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="w-[120px]">Type</TableHead>
                                <TableHead className="w-[120px]">Cost/Hour</TableHead>
                                <TableHead className="w-[120px]">Availability</TableHead>
                                <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody onDragLeave={handleDragLeave}>
                            {Object.entries(groupedResources).map(([groupName, groupItems]) => (
                                <React.Fragment key={groupName}>
                                    {groupBy !== 'none' && (
                                        <TableRow className="bg-muted/50 hover:bg-muted/50 font-semibold">
                                            <TableCell colSpan={7}>{groupName} ({groupItems.length})</TableCell>
                                        </TableRow>
                                    )}
                                    {groupItems.map(resource => (
                                        <TableRow
                                            key={resource.id}
                                            draggable={groupBy === 'none'}
                                            onDragStart={(e) => handleDragStart(e, resource.id)}
                                            onDragOver={(e) => handleDragOver(e, resource.id)}
                                            onDrop={handleDrop}
                                            className={cn(
                                                draggedId === resource.id && "opacity-30",
                                                dropIndicator?.targetId === resource.id && {
                                                    "border-t-2 border-primary": dropIndicator.position === 'top',
                                                    "border-b-2 border-primary": dropIndicator.position === 'bottom',
                                                }
                                            )}
                                        >
                                            <TableCell className="p-0 align-middle text-center">
                                                <div className={cn(
                                                    "flex items-center justify-center h-full",
                                                    groupBy === 'none' ? "cursor-grab text-muted-foreground hover:text-foreground" : "opacity-20 cursor-not-allowed"
                                                )}>
                                                    <GripVertical className="h-4 w-4" />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <EditableCell
                                                    value={resource.name}
                                                    onSave={(newValue) => dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, name: newValue }})}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <EditableCell
                                                    value={resource.category || ''}
                                                    onSave={(newValue) => dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, category: newValue }})}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <EditableSelectCell
                                                    value={resource.type}
                                                    onSave={(newValue) => dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, type: newValue as Resource['type'] }})}
                                                    options={resourceTypeOptions}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <EditableCell
                                                    value={String(resource.costPerHour || 0)}
                                                    onSave={(newValue) => dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, costPerHour: parseFloat(newValue) || 0 }})}
                                                    className="text-right"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <EditableCell
                                                    value={`${(resource.availability || 1) * 100}%`}
                                                    onSave={(newValue) => {
                                                        const percentage = parseFloat(newValue.replace('%', ''));
                                                        if (!isNaN(percentage)) {
                                                            dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, availability: percentage / 100 }})
                                                        }
                                                    }}
                                                    className="text-right"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveResource(resource.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
}
