'use client';
import type { Task, UiDensity } from '@/lib/types';
import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Plus, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { RelationshipComboboxContent } from './relationship-combobox';
import { useState } from 'react';

export function AddRelationshipRow({
    allTasks,
    currentTaskId,
    existingLinkedTaskIds,
    dispatch,
    type, // 'predecessor' or 'successor'
    uiDensity
}: {
    allTasks: Task[],
    currentTaskId: string,
    existingLinkedTaskIds: string[],
    dispatch: any,
    type: 'predecessor' | 'successor',
    uiDensity: UiDensity
}) {
    const [open, setOpen] = useState(false);
    
    const cellInnerDivClass = cn(
        "flex items-center h-full",
        uiDensity === 'large' && "px-4 text-sm",
        uiDensity === 'medium' && "px-3 text-sm",
        uiDensity === 'compact' && "px-2 text-xs"
    );

    const cellClass = cn(
        "p-0 font-medium truncate",
        uiDensity === 'large' && "h-12",
        uiDensity === 'medium' && "h-10",
        uiDensity === 'compact' && "h-8"
    );

    const handleAddTask = (selectedTaskId: string) => {
        if (!selectedTaskId) return;

        dispatch({
            type: 'ADD_LINK',
            payload: {
                source: type === 'predecessor' ? selectedTaskId : currentTaskId,
                target: type === 'predecessor' ? currentTaskId : selectedTaskId,
                type: 'FS',
                lag: 0,
            }
        });
        setOpen(false);
    };

    return (
        <TableRow>
            <TableCell colSpan={6} className={cn(cellClass, "p-0")}>
                <div className={cellInnerDivClass}>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full justify-between h-8 border-dashed text-xs text-muted-foreground"
                        >
                          <span className="flex items-center gap-2">
                            <Plus className="h-3 w-3" />
                            Add new {type}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                          <RelationshipComboboxContent
                            allTasks={allTasks}
                            currentTaskId={currentTaskId}
                            excludedTaskIds={existingLinkedTaskIds}
                            onSelectTask={handleAddTask}
                          />
                      </PopoverContent>
                    </Popover>
                </div>
            </TableCell>
        </TableRow>
    );
}
