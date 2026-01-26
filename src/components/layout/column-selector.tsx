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
import { useState } from "react";
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
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [editingColumn, setEditingColumn] = useState<ColumnSpec | null>(null);

    const handleCheckedChange = (columnId: string, checked: boolean) => {
        const newVisibleColumns = checked
            ? [...visibleColumns, columnId]
            : visibleColumns.filter(c => c !== columnId);
        dispatch({ type: 'SET_COLUMNS', payload: newVisibleColumns });
    };

    const handleSaveColumn = (config: ColumnConfig) => {
        // Immediately start the dialog closing process
        setIsConfigOpen(false);

        // Delay the expensive state update to give the dialog time to animate out and unmount.
        // This prevents its overlay from getting stuck and blocking mouse events.
        setTimeout(() => {
            if (editingColumn) {
                dispatch({ type: 'UPDATE_COLUMN', payload: { id: editingColumn.id, ...config } });
            } else {
                dispatch({ type: 'ADD_COLUMN', payload: config });
            }
            setEditingColumn(null);
        }, 200); // The delay should be slightly longer than the dialog's close animation.
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


    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                        <Columns3 className="h-4 w-4" />
                        Columns
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
