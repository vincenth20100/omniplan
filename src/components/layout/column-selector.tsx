'use client';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button";
import { Columns3, Plus } from "lucide-react";
import type { ColumnSpec } from "@/lib/types";
import { useState, useEffect } from "react";
import { ColumnConfigDialog, type ColumnConfig } from "../view-options/column-config-dialog";

export function ColumnSelector({
    visibleColumns,
    columns,
    dispatch,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
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

    return (
        <>
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" title="Select Visible Columns">
                        <Columns3 className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {columns.map(column => (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={visibleColumns.includes(column.id)}
                            onCheckedChange={(checked) => handleCheckedChange(column.id, Boolean(checked))}
                             onSelect={(e) => {
                                // Prevent dropdown from closing when checking the box
                                e.preventDefault();
                            }}
                        >
                            <span className="flex-grow">{column.name}</span>
                        </DropdownMenuCheckboxItem>
                    ))}
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
