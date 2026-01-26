'use client';
import type { Task, UiDensity, LinkType } from '@/lib/types';
import { TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

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

    const availableTasks = allTasks.filter(t => t.id !== currentTaskId && !existingLinkedTaskIds.includes(t.id));

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
    };

    return (
        <TableRow>
            <TableCell colSpan={6} className={cn(cellClass, "p-0")}>
                <div className={cellInnerDivClass}>
                    <Select onValueChange={handleAddTask}>
                        <SelectTrigger className="h-8 border-dashed w-full text-xs">
                            <SelectValue placeholder={
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Plus className="h-3 w-3" />
                                    Add new {type}
                                </span>
                            } />
                        </SelectTrigger>
                        <SelectContent>
                            {availableTasks.length > 0 ? availableTasks.map(task => (
                                <SelectItem key={task.id} value={task.id}>
                                    {task.wbs} - {task.name}
                                </SelectItem>
                            )) : <p className="p-2 text-xs text-muted-foreground">No tasks available to link.</p>}
                        </SelectContent>
                    </Select>
                </div>
            </TableCell>
        </TableRow>
    );
}
