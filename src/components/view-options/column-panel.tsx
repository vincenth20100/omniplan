'use client';

import { Button } from "@/components/ui/button";
import { Plus, ArrowUp, ArrowDown, Pencil, GripVertical } from "lucide-react";
import type { ColumnSpec } from "@/lib/types";
import { useState, useEffect } from "react";
import { ColumnConfigDialog, type ColumnConfig } from "./column-config-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableColumnItemProps {
    column: ColumnSpec;
    index: number;
    totalCount: number;
    visibleColumns: string[];
    onCheckedChange: (columnId: string, checked: boolean) => void;
    onEdit: (col: ColumnSpec) => void;
    onMove: (index: number, direction: 'up' | 'down') => void;
}

function SortableColumnItem({
    column,
    index,
    totalCount,
    visibleColumns,
    onCheckedChange,
    onEdit,
    onMove
}: SortableColumnItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: column.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center w-full rounded-sm p-2 border-b last:border-0 ${isDragging ? 'bg-accent/80 opacity-80' : 'hover:bg-accent'}`}
        >
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-grab active:cursor-grabbing mr-1 shrink-0 text-muted-foreground hover:text-foreground"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" />
            </Button>

            <Checkbox
                id={`col-vis-${column.id}`}
                checked={visibleColumns.includes(column.id)}
                onCheckedChange={(checked) => onCheckedChange(column.id, Boolean(checked))}
                className="mr-2"
            />
            <label htmlFor={`col-vis-${column.id}`} className="flex-grow truncate cursor-pointer text-sm font-normal select-none">
                {column.name}
            </label>
            <div className="flex items-center ml-2 gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(column); }} title="Edit column">
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={(e) => { e.stopPropagation(); onMove(index, 'up'); }}
                    title="Move up"
                >
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === totalCount - 1}
                    onClick={(e) => { e.stopPropagation(); onMove(index, 'down'); }}
                    title="Move down"
                >
                    <ArrowDown className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export function ColumnPanel({
    visibleColumns,
    columns,
    dispatch,
    onCancel,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    onCancel?: () => void;
}) {
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [editingColumn, setEditingColumn] = useState<ColumnSpec | null>(null);
    const [pendingAction, setPendingAction] = useState<{ type: string, payload: any } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        // When the dialog is closed, if there's a pending action, dispatch it.
        // This ensures the dialog cleanup (removing pointer-events: none) happens BEFORE the heavy dispatch.
        if (!isConfigOpen && pendingAction) {
            dispatch(pendingAction);
            setPendingAction(null); // Clear the pending action
        }
    }, [isConfigOpen, pendingAction, dispatch]);

    const handleSaveColumn = (config: ColumnConfig) => {
        // Instead of dispatching directly, queue the action and close the dialog.
        if (editingColumn) {
            setPendingAction({ type: 'UPDATE_COLUMN', payload: { id: editingColumn.id, ...config } });
        } else {
            setPendingAction({ type: 'ADD_COLUMN', payload: config });
        }
        // This will trigger the re-render that closes the dialog. The useEffect will handle the dispatch.
        setIsConfigOpen(false);
        setEditingColumn(null);
    };

    const handleCheckedChange = (columnId: string, checked: boolean) => {
        const newVisibleColumns = checked
            ? [...visibleColumns, columnId]
            : visibleColumns.filter(c => c !== columnId);
        dispatch({ type: 'SET_COLUMNS', payload: newVisibleColumns });
    };

    const handleOpenNew = () => {
        setEditingColumn(null);
        setIsConfigOpen(true);
    }

    const handleOpenEdit = (col: ColumnSpec) => {
        setEditingColumn(col);
        setIsConfigOpen(true);
    }

    const handleDialogClose = (open: boolean) => {
        if (!open) {
            setEditingColumn(null);
        }
        setIsConfigOpen(open);
    }

    const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= columns.length) return;
        dispatch({ type: 'REORDER_COLUMNS', payload: { sourceId: columns[index].id, targetId: columns[newIndex].id } });
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            dispatch({
                type: 'REORDER_COLUMNS',
                payload: {
                    sourceId: active.id,
                    targetId: over?.id
                }
            });
        }
    };

    return (
        <div className="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Select and reorder columns:</p>
                <Button variant="outline" size="sm" onClick={handleOpenNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Column
                </Button>
            </div>

            <Separator className="mb-2" />

            <div className="flex-1 overflow-y-auto border rounded-md min-h-0">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={columns.map(c => c.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {columns.map((column, index) => (
                            <SortableColumnItem
                                key={column.id}
                                column={column}
                                index={index}
                                totalCount={columns.length}
                                visibleColumns={visibleColumns}
                                onCheckedChange={handleCheckedChange}
                                onEdit={handleOpenEdit}
                                onMove={handleMoveColumn}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>

            {onCancel && (
                 <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={onCancel}>Back</Button>
                </div>
            )}

            <ColumnConfigDialog
                key={editingColumn?.id || 'new'}
                open={isConfigOpen}
                onOpenChange={handleDialogClose}
                onSave={handleSaveColumn}
                column={editingColumn}
            />
        </div>
    );
}
