'use client';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button";
import { Columns3 } from "lucide-react";
import type { ProjectState } from "@/lib/types";

const ALL_COLUMNS = [
    { id: 'wbs', name: 'WBS' },
    { id: 'name', name: 'Task Name' },
    { id: 'duration', name: 'Duration' },
    { id: 'start', name: 'Start' },
    { id: 'finish', name: 'Finish' },
    { id: 'percentComplete', name: '% Complete' },
    { id: 'constraintType', name: 'Constraint Type' },
    { id: 'constraintDate', name: 'Constraint Date' },
];

export function ColumnSelector({
    visibleColumns,
    dispatch,
}: {
    visibleColumns: string[];
    dispatch: any;
}) {
    const handleCheckedChange = (columnId: string, checked: boolean) => {
        const newVisibleColumns = checked
            ? [...visibleColumns, columnId]
            : visibleColumns.filter(c => c !== columnId);
        dispatch({ type: 'SET_COLUMNS', payload: newVisibleColumns });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Columns3 className="mr-2 h-4 w-4" />
                    Columns
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_COLUMNS.map(column => (
                    <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={visibleColumns.includes(column.id)}
                        onCheckedChange={(checked) => handleCheckedChange(column.id, Boolean(checked))}
                    >
                        {column.name}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
