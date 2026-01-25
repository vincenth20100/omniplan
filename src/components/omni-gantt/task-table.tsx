'use client';
import type { Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flame, ChevronRight, ChevronDown } from 'lucide-react';
import React from 'react';

export function TaskTable({ tasks, selectedTaskId, dispatch }: { tasks: Task[], selectedTaskId: string | null, dispatch: any }) {
    const handleSelectTask = (taskId: string) => {
        dispatch({ type: 'SELECT_TASK', payload: taskId });
    };

    const handleToggle = (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      dispatch({ type: 'TOGGLE_TASK_COLLAPSE', payload: { taskId } });
    }

    const visibleTasks = React.useMemo(() => {
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        return tasks.filter(task => {
            if (!task.parentId) return true;
            let parent = taskMap.get(task.parentId);
            while(parent) {
                if (parent.isCollapsed) return false;
                parent = taskMap.get(parent.parentId || '');
            }
            return true;
        });
    }, [tasks]);

    return (
        <ScrollArea className="h-full">
            <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                        <TableHead className="w-[15%]">WBS</TableHead>
                        <TableHead className="w-[45%]">Task Name</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Finish</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleTasks.map((task) => (
                        <TableRow
                            key={task.id}
                            className={cn("cursor-pointer", selectedTaskId === task.id && "bg-accent/50")}
                            onClick={() => handleSelectTask(task.id)}
                        >
                            <TableCell>{task.wbs}</TableCell>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2" style={{ paddingLeft: `${(task.level || 0) * 1.5}rem` }}>
                                    {task.isSummary ? (
                                        <button onClick={(e) => handleToggle(e, task.id)} className="p-0.5 rounded-sm hover:bg-muted -ml-7 mr-2">
                                            {task.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>
                                    ) : (
                                      <div className="w-5" style={{ marginLeft: '-1.75rem', marginRight: '0.5rem' }}></div>
                                    )}
                                    {task.schedulingConflict && <Flame className="h-4 w-4 text-destructive" />}
                                    <span>{task.name}</span>
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
