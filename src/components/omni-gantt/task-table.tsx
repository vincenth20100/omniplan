'use client';
import type { Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flame, ChevronRight, ChevronDown } from 'lucide-react';
import React from 'react';

export function TaskTable({ tasks, selectedTaskId, dispatch, visibleColumns = ['wbs', 'name', 'start', 'finish'] }: { tasks: Task[], selectedTaskId: string | null, dispatch: any, visibleColumns: string[] }) {
    
    const handleSelectTask = (taskId: string) => {
        dispatch({ type: 'SELECT_TASK', payload: taskId });
    };

    const handleToggle = (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      dispatch({ type: 'TOGGLE_TASK_COLLAPSE', payload: { taskId } });
    }

    const columnDefinitions: Record<string, { name: string, render: (task: Task) => React.ReactNode, className?: string }> = {
        wbs: { name: 'WBS', render: (task) => task.wbs, className: "w-[10%]" },
        name: { 
            name: 'Task Name', 
            className: "w-auto",
            render: (task) => (
                <div className="flex items-center gap-2" style={{ paddingLeft: `${(task.level || 0) * 1.5}rem` }}>
                    {task.isSummary ? (
                        <button onClick={(e) => handleToggle(e, task.id)} className="p-0.5 rounded-sm hover:bg-muted -ml-7 mr-2">
                            {task.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    ) : (
                    <div className="w-5" style={{ marginLeft: '-1.75rem', marginRight: '0.5rem' }}></div>
                    )}
                    {task.schedulingConflict && <Flame className="h-4 w-4 text-destructive" />}
                    <span className="truncate">{task.name}</span>
                </div>
            )
        },
        duration: { name: 'Duration', render: (task) => task.duration ? `${task.duration}d` : '', className: "w-[100px]" },
        start: { name: 'Start', render: (task) => format(task.start, 'MMM d, yyyy'), className: "w-[120px]" },
        finish: { name: 'Finish', render: (task) => format(task.finish, 'MMM d, yyyy'), className: "w-[120px]" },
        percentComplete: { name: '% Complete', render: (task) => `${task.percentComplete}%`, className: "w-[100px]" },
        constraintType: { name: 'Constraint Type', render: (task) => task.constraintType, className: "w-[150px]" },
        constraintDate: { name: 'Constraint Date', render: (task) => task.constraintDate ? format(task.constraintDate, 'MMM d, yyyy') : '', className: "w-[120px]" },
    };

    const orderedVisibleColumns = Object.keys(columnDefinitions).filter(id => visibleColumns.includes(id));

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
                        {orderedVisibleColumns.map(columnId => (
                            <TableHead key={columnId} className={columnDefinitions[columnId].className}>
                                {columnDefinitions[columnId].name}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleTasks.map((task) => (
                        <TableRow
                            key={task.id}
                            className={cn("cursor-pointer", selectedTaskId === task.id && "bg-accent/50")}
                            onClick={() => handleSelectTask(task.id)}
                        >
                            {orderedVisibleColumns.map(columnId => (
                                <TableCell key={columnId} className="font-medium">
                                    {columnDefinitions[columnId].render(task)}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
