'use client';
import type { Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flame, ChevronRight, ChevronDown } from 'lucide-react';
import React from 'react';
import { EditableCell } from './editable-cell';

export function TaskTable({ tasks, selectedTaskIds, dispatch, visibleColumns = ['wbs', 'name', 'start', 'finish'] }: { tasks: Task[], selectedTaskIds: string[], dispatch: any, visibleColumns: string[] }) {
    
    const [draggedId, setDraggedId] = React.useState<string | null>(null);
    const [dragOverId, setDragOverId] = React.useState<string | null>(null);

    const childrenMap = React.useMemo(() => {
        const map = new Map<string, Task[]>();
        tasks.forEach(task => {
            if (task.parentId) {
                if (!map.has(task.parentId)) {
                    map.set(task.parentId, []);
                }
                map.get(task.parentId)!.push(task);
            }
        });
        return map;
    }, [tasks]);

    const handleSelectTask = (e: React.MouseEvent, taskId: string) => {
        dispatch({ type: 'SELECT_TASK', payload: { taskId, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey } });
    };

    const handleToggle = (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      dispatch({ type: 'TOGGLE_TASK_COLLAPSE', payload: { taskId } });
    }

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
        if (!selectedTaskIds.includes(taskId)) {
            dispatch({ type: 'SELECT_TASK', payload: { taskId, ctrlKey: false, shiftKey: false }});
        }
        e.dataTransfer.setData('text/plain', taskId);
        setTimeout(() => setDraggedId(taskId), 0);
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
        e.preventDefault();
        if (taskId !== draggedId) {
            setDragOverId(taskId);
        }
    };
    
    const handleDragLeave = () => {
        setDragOverId(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== targetId) {
            // For now, drag-and-drop only supports single-task reordering.
            // Complex multi-task reordering is a future enhancement.
            dispatch({ type: 'REORDER_TASK', payload: { sourceId, targetId } });
        }
        setDraggedId(null);
        setDragOverId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverId(null);
    };


    const columnDefinitions: Record<string, { name: string, render: (task: Task) => React.ReactNode, className?: string }> = {
        wbs: { name: 'WBS', render: (task) => task.wbs, className: "w-[10%]" },
        name: { 
            name: 'Task Name', 
            className: "w-auto",
            render: (task) => {
                const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
                return (
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${(task.level || 0) * 1.5}rem` }}>
                        {hasChildren ? (
                            <button onClick={(e) => handleToggle(e, task.id)} className="p-0.5 rounded-sm hover:bg-muted -ml-7 mr-2">
                                {task.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                        ) : (
                            <div className="w-5" style={{ marginLeft: '-1.75rem', marginRight: '0.5rem' }}></div>
                        )}
                        {task.schedulingConflict && <Flame className="h-4 w-4 text-destructive" />}
                        <div className="flex-grow">
                             {task.isSummary ? (
                                <span className="truncate">{task.name}</span>
                             ) : (
                                <EditableCell
                                    value={task.name}
                                    onSave={(newValue) => {
                                        if (newValue.trim()) {
                                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, name: newValue } })
                                        }
                                    }}
                                    className="truncate"
                                />
                             )}
                        </div>
                    </div>
                )
            }
        },
        duration: { name: 'Duration', render: (task) => {
            const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
            if (task.isSummary && !hasChildren) return '';
            
            const displayValue = task.duration ? `${task.duration}d` : '';
            if (task.isSummary) {
                return <div className="text-right pr-4">{displayValue}</div>;
            }

            return (
                 <EditableCell
                    value={`${task.duration}`}
                    onSave={(newValue) => {
                        const newDuration = parseInt(newValue, 10);
                        if (!isNaN(newDuration) && newDuration > 0) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, duration: newDuration } });
                        }
                    }}
                    className="text-right pr-4"
                />
            );
        }, className: "w-[100px]" },
        start: { name: 'Start', render: (task) => {
            const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
            if (task.isSummary && !hasChildren) return '';
            return format(task.start, 'MMM d, yyyy');
        }, className: "w-[120px]" },
        finish: { name: 'Finish', render: (task) => {
            const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
            if (task.isSummary && !hasChildren) return '';
            return format(task.finish, 'MMM d, yyyy');
        }, className: "w-[120px]" },
        percentComplete: { name: '% Complete', render: (task) => {
            const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
            if (task.isSummary && !hasChildren) return '';
            return `${task.percentComplete}%`;
        }, className: "w-[100px]" },
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
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDrop={(e) => handleDrop(e, task.id)}
                            onDragOver={(e) => handleDragOver(e, task.id)}
                            onDragLeave={handleDragLeave}
                            onDragEnd={handleDragEnd}
                            className={cn(
                                "cursor-pointer", 
                                "transition-all duration-150",
                                selectedTaskIds.includes(task.id) && "bg-accent/50 hover:bg-accent/50",
                                draggedId === task.id && "opacity-30",
                                dragOverId === task.id && "border-t-2 border-primary"
                            )}
                            onClick={(e) => handleSelectTask(e, task.id)}
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
