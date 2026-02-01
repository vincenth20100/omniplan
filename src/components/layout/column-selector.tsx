'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button";
import { Columns3, Plus, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import type { ColumnSpec } from "@/lib/types";
import { useState, useEffect } from "react";
import { ColumnConfigDialog, type ColumnConfig } from "../view-options/column-config-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export function ColumnSelector({
    visibleColumns,
    columns,
    dispatch,
    disabled,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    disabled?: boolean;
}) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [editingColumn, setEditingColumn] = useState<ColumnSpec | null>(null);
    const [pendingAction, setPendingAction] = useState<{ type: string, payload: any } | null>(null);

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
        setIsMenuOpen(false); // Explicitly close the menu
    }
    
    const handleOpenEdit = (col: ColumnSpec) => {
        setEditingColumn(col);
        setIsConfigOpen(true);
        setIsMenuOpen(false); // Explicitly close the menu
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

    const renderColumnItem = (column: ColumnSpec, index: number) => (
        <div className="flex items-center w-full hover:bg-accent rounded-sm p-1">
            <Checkbox
                id={`col-vis-${column.id}`}
                checked={visibleColumns.includes(column.id)}
                onCheckedChange={(checked) => handleCheckedChange(column.id, Boolean(checked))}
                className="mr-2"
            />
            <label htmlFor={`col-vis-${column.id}`} className="flex-grow truncate cursor-pointer text-sm font-normal">{column.name}</label>
            <div className="flex items-center ml-2">
                {column.id.startsWith('custom-') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenEdit(column); }} title="Edit column">
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={(e) => { e.stopPropagation(); handleMoveColumn(index, 'up'); }}
                    title="Move up"
                >
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === columns.length - 1}
                    onClick={(e) => { e.stopPropagation(); handleMoveColumn(index, 'down'); }}
                    title="Move down"
                >
                    <ArrowDown className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );

    return (
        <>
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" title="Select Visible Columns" disabled={disabled}>
                        <Columns3 className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                    <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <ScrollArea className="h-[240px] pr-2">
                        {columns.map((column, index) => (
                             <DropdownMenuItem
                                key={column.id}
                                onSelect={(e) => e.preventDefault()}
                                className="p-0 focus:bg-transparent"
                            >
                                {renderColumnItem(column, index)}
                            </DropdownMenuItem>
                        ))}
                    </ScrollArea>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOpenNew}>
                        <Plus className="mr-2 h-4 w-4" />
                        <span>New Column</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <ColumnConfigDialog
                key={editingColumn?.id || 'new'}
                open={isConfigOpen}
                onOpenChange={handleDialogClose}
                onSave={handleSaveColumn}
                column={editingColumn}
            />
        </>
    );
}
