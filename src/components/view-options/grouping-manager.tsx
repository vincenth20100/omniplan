'use client';

import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import type { ColumnSpec } from "@/lib/types";

export function GroupingManager({ grouping, columns, dispatch }: { grouping: string[], columns: ColumnSpec[], dispatch: any }) {
    const groupableColumns = columns.filter(c => !['wbs', 'name', 'duration', 'start', 'finish', 'predecessors', 'successors', 'percentComplete'].includes(c.id));

    const handleCheckedChange = (columnId: string, checked: boolean) => {
        // This logic maintains the order based on the `groupableColumns` array.
        const currentGrouping = new Set(grouping);
        if (checked) {
            currentGrouping.add(columnId);
        } else {
            currentGrouping.delete(columnId);
        }

        const newGrouping = groupableColumns
            .map(c => c.id)
            .filter(id => currentGrouping.has(id));

        dispatch({ type: 'SET_GROUPING', payload: newGrouping });
    }

    const handleClear = () => {
        dispatch({ type: 'SET_GROUPING', payload: [] });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2">
                    <Layers className="h-4 w-4" />
                    Group
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Group By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {groupableColumns.map(col => (
                    <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={grouping.includes(col.id)}
                        onCheckedChange={(checked) => handleCheckedChange(col.id, Boolean(checked))}
                        onSelect={(e) => {
                            e.preventDefault();
                        }}
                    >
                        {col.name}
                    </DropdownMenuCheckboxItem>
                ))}
                 {grouping.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={handleClear}>
                            Clear Grouping
                        </DropdownMenuItem>
                    </>
                 )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
