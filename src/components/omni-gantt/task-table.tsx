'use client';
import type { Task, ColumnSpec, UiDensity, Link, Resource, Assignment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flame, ChevronRight, ChevronDown } from 'lucide-react';
import React from 'react';
import { EditableCell } from './editable-cell';
import { EditableDateCell } from './editable-date-cell';
import { EditableSelectCell } from './editable-select-cell';
import type { ConstraintType } from '@/lib/types';


export function TaskTable({ 
    tasks, 
    links,
    resources,
    assignments,
    selectedTaskIds, 
    dispatch, 
    visibleColumns = ['wbs', 'name', 'start', 'finish'],
    columns,
    viewportRef,
    onScroll,
    uiDensity
}: { 
    tasks: Task[], 
    links: Link[],
    resources: Resource[],
    assignments: Assignment[],
    selectedTaskIds: string[], 
    dispatch: any, 
    visibleColumns: string[],
    columns: ColumnSpec[],
    viewportRef: React.RefObject<HTMLDivElement>,
    onScroll: () => void,
    uiDensity: UiDensity
}) {
    
    const [draggedIds, setDraggedIds] = React.useState<string[] | null>(null);
    const [dropIndicator, setDropIndicator] = React.useState<{ targetId: string; position: 'top' | 'bottom' | 'child' } | null>(null);

    const [draggedColId, setDraggedColId] = React.useState<string | null>(null);
    const [dropColIndicator, setDropColIndicator] = React.useState<{ targetId: string } | null>(null);


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

    // Row Drag & Drop
    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
        let sourceIds = [...selectedTaskIds];
        if (!sourceIds.includes(taskId)) {
            sourceIds = [taskId];
            dispatch({ type: 'SELECT_TASK', payload: { taskId, ctrlKey: false, shiftKey: false }});
        }
        
        e.dataTransfer.setData('application/json', JSON.stringify(sourceIds));
        e.dataTransfer.effectAllowed = 'move';
        
        setTimeout(() => setDraggedIds(sourceIds), 0);
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, taskId: string) => {
        e.preventDefault();

        if (!draggedIds || draggedIds.includes(taskId)) {
            setDropIndicator(null);
            return;
        }

        const taskMap = new Map(tasks.map(t => [t.id, t]));
        for (const sourceId of draggedIds) {
            let p: Task | undefined | null = taskMap.get(taskId);
            while (p) {
                if (p.id === sourceId) {
                    setDropIndicator(null);
                    return; // Prevent nesting a task under its own descendant
                }
                p = p.parentId ? taskMap.get(p.parentId) : null;
            }
        }
        
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const indentThreshold = 50;

        if (x > indentThreshold) {
            setDropIndicator({ targetId: taskId, position: 'child' });
        } else {
            if (y < rect.height / 2) {
                setDropIndicator({ targetId: taskId, position: 'top' });
            } else {
                setDropIndicator({ targetId: taskId, position: 'bottom' });
            }
        }
    };
    
    const handleDragLeave = () => {
        setDropIndicator(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        
        if (!dropIndicator || !draggedIds) return;

        const { targetId, position } = dropIndicator;
        
        if (position === 'child') {
             dispatch({ type: 'NEST_TASKS', payload: { sourceIds: draggedIds, parentId: targetId } });
        } else {
            dispatch({ type: 'REORDER_TASKS', payload: { sourceIds: draggedIds, targetId, position } });
        }

        setDraggedIds(null);
        setDropIndicator(null);
    };

    const handleDragEnd = () => {
        setDraggedIds(null);
        setDropIndicator(null);
    };

    // Column Drag & Drop and Resize
    const handleColDragStart = (e: React.DragEvent<HTMLTableCellElement>, columnId: string) => {
        e.dataTransfer.setData('text/plain', columnId);
        setDraggedColId(columnId);
    };

    const handleColDragOver = (e: React.DragEvent<HTMLTableCellElement>, targetId: string) => {
        e.preventDefault();
        if (draggedColId && draggedColId !== targetId) {
            setDropColIndicator({ targetId });
        }
    };
    
    const handleColDragLeave = (e: React.DragEvent<HTMLTableCellElement>) => {
        setDropColIndicator(null);
    }

    const handleColDrop = (e: React.DragEvent<HTMLTableCellElement>, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== targetId) {
            dispatch({ type: 'REORDER_COLUMNS', payload: { sourceId, targetId } });
        }
        setDraggedColId(null);
        setDropColIndicator(null);
    };

    const handleColDragEnd = () => {
        setDraggedColId(null);
        setDropColIndicator(null);
    };

    const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, columnId: string) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = columns.find(c => c.id === columnId)?.width ?? 0;
        
        const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
            const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
            if (newWidth > 30) { // min width
                 dispatch({ type: 'RESIZE_COLUMN', payload: { columnId, width: newWidth } });
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleResizeTouchStart = (e: React.TouchEvent<HTMLDivElement>, columnId: string) => {
        e.stopPropagation();

        const startX = e.touches[0].clientX;
        const startWidth = columns.find(c => c.id === columnId)?.width ?? 0;
        
        const handleTouchMove = (touchMoveEvent: TouchEvent) => {
            if (touchMoveEvent.cancelable) touchMoveEvent.preventDefault();
            const newWidth = startWidth + (touchMoveEvent.touches[0].clientX - startX);
            if (newWidth > 30) { // min width
                 dispatch({ type: 'RESIZE_COLUMN', payload: { columnId, width: newWidth } });
            }
        };

        const handleTouchEnd = () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    };

    const columnDefinitions: Record<string, { name: string, render: (task: Task) => React.ReactNode }> = {
        wbs: { name: 'WBS', render: (task) => task.wbs },
        name: { 
            name: 'Task Name', 
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
        resourceNames: { 
            name: 'Resource Names', 
            render: (task) => {
                if (task.isSummary) return '';
                const resourceMap = new Map(resources.map(r => [r.id, r.name]));
                const taskAssignments = assignments.filter(a => a.taskId === task.id);
                const resourceNames = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
                
                return <div className="truncate">{resourceNames}</div>;
            }
        },
        predecessors: { 
            name: 'Predecessors', 
            render: (task) => {
                if (task.isSummary) return '';
                const idToWbsMap = new Map(tasks.map(t => [t.id, t.wbs]));
                const predecessorLinks = links.filter(l => l.target === task.id);
                const predecessorString = predecessorLinks.map(l => {
                    const sourceWbs = idToWbsMap.get(l.source);
                    if (!sourceWbs) return '';
                    let lagString = '';
                    if (l.lag > 0) lagString = `+${l.lag}d`;
                    if (l.lag < 0) lagString = `${l.lag}d`;
                    return `${sourceWbs}${l.type}${lagString}`;
                }).join(', ');
                
                return (
                    <EditableCell
                        value={predecessorString}
                        onSave={(newValue) => {
                            dispatch({ type: 'UPDATE_RELATIONSHIPS', payload: { taskId: task.id, field: 'predecessors', value: newValue } });
                        }}
                    />
                );
            }
        },
        successors: { 
            name: 'Successors', 
            render: (task) => {
                if (task.isSummary) return '';
                const idToWbsMap = new Map(tasks.map(t => [t.id, t.wbs]));
                const successorLinks = links.filter(l => l.source === task.id);
                const successorString = successorLinks.map(l => {
                    const targetWbs = idToWbsMap.get(l.target);
                    if (!targetWbs) return '';
                    let lagString = '';
                    if (l.lag > 0) lagString = `+${l.lag}d`;
                    if (l.lag < 0) lagString = `${l.lag}d`;
                    return `${targetWbs}${l.type}${lagString}`;
                }).join(', ');
                
                return (
                    <EditableCell
                        value={successorString}
                        onSave={(newValue) => {
                            dispatch({ type: 'UPDATE_RELATIONSHIPS', payload: { taskId: task.id, field: 'successors', value: newValue } });
                        }}
                    />
                );
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
        }},
        start: { name: 'Start', render: (task) => {
            const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
            if (task.isSummary && !hasChildren) return '';
            if (task.isSummary) return format(task.start, 'MMM d, yyyy');

            return (
                <EditableDateCell
                    value={task.start}
                    onSave={(newDate) => {
                        if (newDate) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, start: newDate } });
                        }
                    }}
                />
            );
        }},
        finish: { name: 'Finish', render: (task) => {
            const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
            if (task.isSummary && !hasChildren) return '';
            if (task.isSummary) return format(task.finish, 'MMM d, yyyy');

            return (
                <EditableDateCell
                    value={task.finish}
                    onSave={(newDate) => {
                        if (newDate) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, finish: newDate } });
                        }
                    }}
                />
            );
        }},
        percentComplete: { name: '% Complete', render: (task) => {
            const hasChildren = task.isSummary && childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
            if (task.isSummary && !hasChildren) return '';
            if (task.isSummary) return `${task.percentComplete}%`;

            return (
                <EditableCell
                    value={`${task.percentComplete}`}
                    onSave={(newValue) => {
                        const newPercent = parseInt(newValue, 10);
                        if (!isNaN(newPercent) && newPercent >= 0 && newPercent <= 100) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, percentComplete: newPercent } });
                        }
                    }}
                    className="text-right pr-4"
                />
            );
        }},
        constraintType: { name: 'Constraint Type', render: (task) => {
            if (task.isSummary) return '';
            const constraintOptions = [
                { value: 'Start No Earlier Than', label: 'Start No Earlier Than' },
                { value: 'Must Start On', label: 'Must Start On' },
            ];
            return (
                <EditableSelectCell
                    value={task.constraintType || null}
                    onSave={(newValue) => {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, constraintType: newValue as ConstraintType | null } });
                    }}
                    options={constraintOptions}
                    placeholder="None"
                />
            );
        }},
        constraintDate: { name: 'Constraint Date', render: (task) => {
            if (task.isSummary || !task.constraintType) return '';

             return (
                <EditableDateCell
                    value={task.constraintDate}
                    onSave={(newDate) => {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, constraintDate: newDate } });
                    }}
                />
            );
        }},
        cost: { name: 'Cost', render: (task) => {
            const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
            if (task.isSummary) {
                return <div className="text-right pr-4">{currencyFormatter.format(task.cost || 0)}</div>;
            }
            return (
                 <EditableCell
                    value={`${task.cost || 0}`}
                    onSave={(newValue) => {
                        const newCost = parseFloat(newValue);
                        if (!isNaN(newCost)) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, cost: newCost } });
                        }
                    }}
                    className="text-right pr-4"
                />
            );
        }},
    };

    columns.forEach(col => {
        if (col.id.startsWith('custom-') && !columnDefinitions[col.id]) {
            columnDefinitions[col.id] = {
                name: col.name,
                render: (task) => {
                    if (task.isSummary) return '';
                    return (
                        <EditableCell
                            value={task.customAttributes?.[col.id] || ''}
                            onSave={(newValue) => {
                                dispatch({
                                    type: 'UPDATE_TASK',
                                    payload: {
                                        id: task.id,
                                        customAttributes: {
                                            ...(task.customAttributes || {}),
                                            [col.id]: newValue
                                        }
                                    }
                                });
                            }}
                            className="w-full"
                        />
                    );
                }
            }
        }
    });

    const orderedAndVisibleColumns = React.useMemo(() => {
        return columns.filter(c => visibleColumns.includes(c.id));
    }, [columns, visibleColumns]);

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
        <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
            <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]" onScroll={onScroll}>
                <Table style={{ tableLayout: 'fixed' }} className="w-auto">
                    <colgroup>
                        {orderedAndVisibleColumns.map((col) => (
                            <col key={col.id} style={{ width: `${col.width}px` }} />
                        ))}
                    </colgroup>
                    <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                            {orderedAndVisibleColumns.map(column => {
                                const colDef = columnDefinitions[column.id];
                                if (!colDef) return null;

                                return (
                                    <TableHead 
                                        key={column.id} 
                                        draggable
                                        onDragStart={(e) => handleColDragStart(e, column.id)}
                                        onDragOver={(e) => handleColDragOver(e, column.id)}
                                        onDragLeave={handleColDragLeave}
                                        onDrop={(e) => handleColDrop(e, column.id)}
                                        onDragEnd={handleColDragEnd}
                                        className={cn(
                                            "relative group select-none overflow-hidden",
                                            draggedColId === column.id && "opacity-50",
                                            dropColIndicator?.targetId === column.id && "border-l-2 border-primary"
                                        )}
                                    >
                                        {colDef.name}
                                        <div 
                                            className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-border opacity-0 group-hover:opacity-100"
                                            onMouseDown={(e) => handleResizeMouseDown(e, column.id)}
                                            onTouchStart={(e) => handleResizeTouchStart(e, column.id)}
                                        />
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody onDrop={handleDrop} onDragEnd={handleDragEnd} onDragLeave={handleDragLeave}>
                        {visibleTasks.map((task) => (
                            <TableRow
                                key={task.id}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onDragOver={(e) => handleDragOver(e, task.id)}
                                data-density={uiDensity}
                                className={cn(
                                    "cursor-pointer", 
                                    "transition-all duration-150",
                                    "data-[density=large]:h-12 data-[density=medium]:h-10 data-[density=compact]:h-8",
                                    selectedTaskIds.includes(task.id) && "bg-accent/50 hover:bg-accent/50",
                                    !selectedTaskIds.includes(task.id) && "hover:bg-muted/50",
                                    draggedIds?.includes(task.id) && "opacity-30",
                                    !draggedIds?.includes(task.id) && dropIndicator?.targetId === task.id && {
                                        "border-t-2 border-primary": dropIndicator.position === 'top',
                                        "border-b-2 border-primary": dropIndicator.position === 'bottom',
                                        "bg-primary/20": dropIndicator.position === 'child',
                                    }
                                )}
                                onClick={(e) => handleSelectTask(e, task.id)}
                            >
                                {orderedAndVisibleColumns.map(column => (
                                    <TableCell 
                                        key={column.id} 
                                        data-density={uiDensity}
                                        className={cn(
                                            "font-medium truncate p-0",
                                            "data-[density=large]:h-12 data-[density=medium]:h-10 data-[density=compact]:h-8"
                                        )}
                                    >
                                        <div 
                                            className={cn(
                                                "flex items-center h-full",
                                                "data-[density=large]:px-4 data-[density=large]:text-sm",
                                                "data-[density=medium]:px-3 data-[density=medium]:text-sm",
                                                "data-[density=compact]:px-2 data-[density=compact]:text-xs",
                                            )}
                                            data-density={uiDensity}
                                        >
                                          {columnDefinitions[column.id]?.render(task)}
                                        </div>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollAreaPrimitive.Viewport>
            <ScrollBar orientation="vertical" />
            <ScrollBar orientation="horizontal" />
            <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
    );
}
