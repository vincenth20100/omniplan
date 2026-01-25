'use client';
import type { Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

export function TaskTable({ tasks, selectedTaskId, dispatch }: { tasks: Task[], selectedTaskId: string | null, dispatch: any }) {
    const handleSelectTask = (taskId: string) => {
        dispatch({ type: 'SELECT_TASK', payload: taskId });
    };

    return (
        <ScrollArea className="h-full">
            <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                        <TableHead className="w-[60%]">Task Name</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Finish</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map((task) => (
                        <TableRow
                            key={task.id}
                            className={cn("cursor-pointer", selectedTaskId === task.id && "bg-accent/50")}
                            onClick={() => handleSelectTask(task.id)}
                        >
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {task.schedulingConflict && <Flame className="h-4 w-4 text-destructive" />}
                                    {task.name}
                                </div>
                            </TableCell>
                            <TableCell>{format(task.start, 'MMM d, yyyy')}</TableCell>
                            <TableCell>{format(task.finish, 'MMM d, yyyy')}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
