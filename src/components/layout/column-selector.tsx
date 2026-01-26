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

export function ColumnSelector({
    visibleColumns,
    columns,
    dispatch,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
}) {
    const handleCheckedChange = (columnId: string, checked: boolean) => {
        const newVisibleColumns = checked
            ? [...visibleColumns, columnId]
            : visibleColumns.filter(c => c !== columnId);
        dispatch({ type: 'SET_COLUMNS', payload: newVisibleColumns });
    };

    const handleAddColumn = () => {
        dispatch({ type: 'ADD_COLUMN' });
    }

    return (
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
                    >
                        {column.name}
                    </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleAddColumn}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>New Column</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
