'use client';
import type { Task, ColumnSpec, UiDensity, Link, Resource, Assignment, ProjectState, Calendar } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flame, ChevronRight, ChevronDown, Settings2, Pencil, Trash2, MessageSquare, ArrowRight, Calendar as CalendarIndicatorIcon, Flag } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { EditableCell } from './editable-cell';
import { EditableDateCell } from './editable-date-cell';
import { EditableSelectCell } from './editable-select-cell';
import type { ConstraintType } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '../ui/button';
import { ColumnConfigDialog, type ColumnConfig } from '../view-options/column-config-dialog';
import { type RenderableRow, type TaskRow } from './gantt-chart';
import { parseDuration, formatDuration } from '@/lib/duration';

const TaskCellRenderer = React.memo(({
    task,
    column,
    dispatch,
    links,
    idToWbsMap,
    resourceMap,
    assignments,
    handleToggle,
    displayLevel,
    grouping,
    tasks,
    defaultCalendar,
    isEditing,
    editingInitialValue,
    onStopEditing
}: {
    task: Task;
    column: ColumnSpec;
    dispatch: any;
    links: Link[];
    idToWbsMap: Map<string, string>;
    resourceMap: Map<string, string>;
    assignments: Assignment[];
    handleToggle: (e: React.MouseEvent, taskId: string) => void;
    displayLevel: number;
    grouping: string[];
    tasks: Task[];
    defaultCalendar: Calendar | null;
    isEditing: boolean;
    editingInitialValue?: string;
    onStopEditing: () => void;
}) => {
    const isEditable = !task.isSummary || grouping.length > 0;

    switch (column.id) {
        case 'wbs':
            return <>{task.wbs}</>;
        case 'schedulingMode': {
            if (task.isSummary) return null;

            const hasDrivingPredecessor = links.some(l => l.target === task.id && l.isDriving);

            if (hasDrivingPredecessor) {
                return <ArrowRight className="h-4 w-4 text-muted-foreground" title="Scheduled by predecessor"/>
            }
    
            if (task.constraintType && task.constraintDate) {
                return <CalendarIndicatorIcon className="h-4 w-4 text-blue-500" title="Scheduled by constraint"/>
            }
            
            // 'asap' case
            return <div className="w-4 h-4" />;
        }
        case 'name': {
            const isGrouped = grouping.length > 0;
            const hasChildren = !isGrouped && task.isSummary;
            const indentLevel = displayLevel;
            const hasNotes = (task.notes && task.notes.length > 0) || !!task.additionalNotes;

            return (
                <div className="flex items-center gap-1" style={{ paddingLeft: `${indentLevel * 1.5}rem` }}>
                    {hasChildren ? (
                        <button
                          onClick={(e) => handleToggle(e, task.id)}
                          className={cn(
                            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm p-0 hover:bg-muted"
                          )}
                        >
                            {task.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    ) : (
                         <div className={cn(
                            "w-5 flex-shrink-0"
                         )}></div>
                    )}
                    {hasNotes && <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" title="Task has notes or additional information" />}
                    {task.schedulingConflict && <Flame className="h-4 w-4 text-destructive flex-shrink-0" title="Scheduling Conflict" />}
                    {task.deadlineMissed && task.deadline && <Flag className="h-4 w-4 text-destructive flex-shrink-0" title={`Deadline missed. Deadline was ${format(task.deadline, 'MMM d, yyyy')}`} />}
                    <div className="flex-grow">
                            {task.isSummary && !isGrouped ? (
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
                                isEditing={isEditing}
                                initialValue={editingInitialValue}
                                onStopEditing={onStopEditing}
                            />
                            )}
                    </div>
                </div>
            )
        }
        case 'resourceNames': {
            if (task.isSummary && grouping.length === 0) return null;
            const taskAssignments = assignments.filter(a => a.taskId === task.id);
            const resourceNames = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
            return <div className="truncate">{resourceNames}</div>;
        }
        case 'predecessors': {
            if (task.isSummary) return null;
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
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
                />
            );
        }
        case 'successors': {
            if (task.isSummary) return null;
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
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
                />
            );
        }
        case 'duration': {
            if (!isEditable) {
                return <div className="text-right pr-4">{task.duration ? formatDuration(task.duration, task.durationUnit) : ''}</div>;
            }

            return (
                <EditableCell
                    value={formatDuration(task.duration, task.durationUnit)}
                    onSave={(newValue) => {
                        const parsed = parseDuration(newValue);
                        if (parsed) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, duration: parsed.value, durationUnit: parsed.unit } });
                        }
                    }}
                    className="text-right pr-4"
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
                />
            );
        }
        case 'start': {
            if (!isEditable) return <>{format(task.start, 'MMM d, yyyy')}</>;

            return (
                <EditableDateCell
                    value={task.start}
                    onSave={(newDate) => {
                        if (newDate) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, start: newDate } });
                        }
                    }}
                    calendar={defaultCalendar}
                />
            );
        }
        case 'finish': {
            if (!isEditable) return <>{format(task.finish, 'MMM d, yyyy')}</>;

            return (
                <EditableDateCell
                    value={task.finish}
                    onSave={(newDate) => {
                        if (newDate) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, finish: newDate } });
                        }
                    }}
                    calendar={defaultCalendar}
                />
            );
        }
        case 'percentComplete': {
            if (!isEditable) return <>{`${task.percentComplete}%`}</>;

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
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
                />
            );
        }
        case 'constraintType': {
            if (task.isSummary) return null;
            const constraintOptions = [
                { value: 'Finish No Earlier Than', label: 'Finish No Earlier Than' },
                { value: 'Finish No Later Than', label: 'Finish No Later Than' },
                { value: 'Must Finish On', label: 'Must Finish On' },
                { value: 'Must Start On', label: 'Must Start On' },
                { value: 'Start No Earlier Than', label: 'Start No Earlier Than' },
                { value: 'Start No Later Than', label: 'Start No Later Than' },
            ];
            return (
                <EditableSelectCell
                    value={task.constraintType || null}
                    onSave={(newValue) => {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, constraintType: newValue as ConstraintType | null } });
                    }}
                    options={constraintOptions}
                    placeholder="As Soon As Possible"
                />
            );
        }
        case 'constraintDate': {
            if (task.isSummary || !task.constraintType) return null;
            
            const isConstraintDriven = !links.some(l => l.target === task.id && l.isDriving) && !!task.constraintDate;

            return (
                <EditableDateCell
                    value={task.constraintDate}
                    onSave={(newDate) => {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, constraintDate: newDate } });
                    }}
                    calendar={defaultCalendar}
                    className={cn(isConstraintDriven && "text-blue-500 font-semibold")}
                />
            );
        }
        case 'cost': {
            const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
            if (!isEditable) {
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
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
                />
            );
        }
        default: {
            if (column.id.startsWith('custom-')) {
                if (task.isSummary && grouping.length === 0) {
                    if (column.type === 'number') {
                        const value = task.customAttributes?.[column.id] || 0;
                        return <div className="text-right pr-4">{value}</div>
                    }
                    return null;
                }
                
                if (column.type === 'selection' && column.options) {
                    return (
                        <EditableSelectCell
                            value={task.customAttributes?.[column.id] || null}
                            onSave={(newValue) => {
                                dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, customAttributes: { ...(task.customAttributes || {}), [column.id]: newValue } } });
                            }}
                            options={column.options.map(o => ({ value: o, label: o }))}
                            placeholder="Select..."
                        />
                    );
                }

                return (
                    <EditableCell
                        value={String(task.customAttributes?.[column.id] || '')}
                        onSave={(newValue) => {
                            let valueToSave: string | number = newValue;
                            if (column.type === 'number') {
                                const num = parseFloat(newValue);
                                valueToSave = isNaN(num) ? 0 : num;
                            }
                            dispatch({
                                type: 'UPDATE_TASK',
                                payload: {
                                    id: task.id,
                                    customAttributes: { ...(task.customAttributes || {}), [column.id]: valueToSave }
                                }
                            });
                        }}
                        className={cn("w-full", column.type === 'number' && "text-right pr-4")}
                        isEditing={isEditing}
                        initialValue={editingInitialValue}
                        onStopEditing={onStopEditing}
                    />
                );
            }
            return null;
        }
    }
});
TaskCellRenderer.displayName = 'TaskCellRenderer';


export function TaskTable({ 
    projectState,
    renderableRows,
    dispatch, 
    viewportRef,
    onScroll,
    uiDensity,
    onToggleGroup,
}: { 
    projectState: ProjectState,
    renderableRows: RenderableRow[],
    dispatch: any, 
    viewportRef: React.RefObject<HTMLDivElement>,
    onScroll: () => void,
    uiDensity: UiDensity,
    onToggleGroup: (groupId: string) => void,
}) {
    const { tasks, links, resources, assignments, selectedTaskIds, visibleColumns, columns, grouping, activeCell, calendars, defaultCalendarId, editingCell } = projectState;
    const stateRef = useRef(projectState);

    useEffect(() => {
        stateRef.current = projectState;
    }, [projectState]);

    const idToWbsMap = React.useMemo(() => new Map(tasks.map(t => [t.id, t.wbs || ''])), [tasks]);
    
    const getCellValueForEditing = useCallback((taskId: string, columnId: string): string => {
        const { tasks, links } = stateRef.current;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return '';
        switch (columnId) {
            case 'name':
                return task.name;
            case 'duration':
                return formatDuration(task.duration, task.durationUnit);
            case 'percentComplete':
                return String(task.percentComplete);
            case 'cost':
                return String(task.cost || 0);
            case 'predecessors': {
                const predecessorLinks = links.filter(l => l.target === task.id);
                return predecessorLinks.map(l => {
                    const sourceWbs = idToWbsMap.get(l.source);
                    if (!sourceWbs) return '';
                    let lagString = '';
                    if (l.lag > 0) lagString = `+${l.lag}d`;
                    else if (l.lag < 0) lagString = `${l.lag}d`;
                    return `${sourceWbs}${l.type}${lagString}`;
                }).join(', ');
            }
            case 'successors': {
                 const successorLinks = links.filter(l => l.source === task.id);
                return successorLinks.map(l => {
                    const targetWbs = idToWbsMap.get(l.target);
                    if (!targetWbs) return '';
                    let lagString = '';
                    if (l.lag > 0) lagString = `+${l.lag}d`;
                    else if (l.lag < 0) lagString = `${l.lag}d`;
                    return `${targetWbs}${l.type}${lagString}`;
                }).join(', ');
            }
            default:
                if (columnId.startsWith('custom-')) {
                    return String(task.customAttributes?.[columnId] || '');
                }
                return '';
        }
    }, [idToWbsMap]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const { activeCell, columns, visibleColumns, editingCell } = stateRef.current;

            const isEditing = !!editingCell;
            const isNavKey = event.key.startsWith('Arrow') || event.key === 'Enter';

            // If editing, commit value on Enter/Arrow, then allow navigation logic to run
            if (isEditing && isNavKey) {
                event.preventDefault();
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
            }

            if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    dispatch({ type: 'INDENT_TASK' });
                    return;
                }
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    dispatch({ type: 'OUTDENT_TASK' });
                    return;
                }
            }

            if (!activeCell && event.key !== 'Insert') return;

            if (event.key === 'Insert') {
                event.preventDefault();
                dispatch({ type: 'ADD_TASK' });
                return;
            }

            // F2 key to start editing without clearing content
            if (event.key === 'F2') {
              event.preventDefault();
              if (!isEditing && activeCell) {
                const value = getCellValueForEditing(activeCell.taskId, activeCell.columnId);
                dispatch({
                    type: 'START_EDITING_CELL',
                    payload: { ...activeCell, initialValue: value }
                });
              }
              return;
            }
            
            // If editing and not a nav key, let the input handle it
            if (isEditing && !isNavKey) {
                return;
            }

            // Start editing on Enter
            if (event.key === 'Enter' && !isEditing && activeCell) {
                 event.preventDefault();
                const value = getCellValueForEditing(activeCell.taskId, activeCell.columnId);
                dispatch({
                    type: 'START_EDITING_CELL',
                    payload: { ...activeCell, initialValue: value }
                });
                return;
            }

            // Type-to-edit logic
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && activeCell) {
                event.preventDefault();
                dispatch({
                    type: 'START_EDITING_CELL',
                    payload: { ...activeCell, initialValue: event.key }
                });
                return;
            }
            if (event.key === 'Backspace' && activeCell) {
                event.preventDefault();
                dispatch({
                    type: 'START_EDITING_CELL',
                    payload: { ...activeCell, initialValue: '' }
                });
                return;
            }

            if (event.key.startsWith('Arrow') && activeCell) {
                event.preventDefault();

                const orderedVisibleColumns = columns.filter(c => visibleColumns.includes(c.id));
                const activeRowIndex = renderableRows.findIndex(r => r.itemType === 'task' && r.data.id === activeCell.taskId);
                const activeColIndex = orderedVisibleColumns.findIndex(c => c.id === activeCell.columnId);

                if (activeRowIndex === -1 || activeColIndex === -1) return;

                if (event.shiftKey) {
                    let nextRowIndex = activeRowIndex + (event.key === 'ArrowDown' ? 1 : -1);
                    // Find next actual task row, skipping groups
                    while(renderableRows[nextRowIndex] && renderableRows[nextRowIndex].itemType === 'group') {
                        nextRowIndex += (event.key === 'ArrowDown' ? 1 : -1);
                    }

                    if (nextRowIndex >= 0 && nextRowIndex < renderableRows.length) {
                        const nextTaskRow = renderableRows[nextRowIndex] as TaskRow;
                        // Move active cell
                        dispatch({ type: 'SET_ACTIVE_CELL', payload: { taskId: nextTaskRow.data.id, columnId: activeCell.columnId }});
                        // Extend selection
                        dispatch({ type: 'SELECT_TASK', payload: { taskId: nextTaskRow.data.id, shiftKey: true } });
                    }
                } else { // Not holding shift
                    let nextTaskId = activeCell.taskId;
                    let nextColId = activeCell.columnId;

                    switch (event.key) {
                        case 'ArrowDown': {
                            let nextRowIndex = activeRowIndex + 1;
                            while(renderableRows[nextRowIndex] && renderableRows[nextRowIndex].itemType === 'group') {
                                nextRowIndex++;
                            }
                            if (nextRowIndex < renderableRows.length) {
                                const row = renderableRows[nextRowIndex];
                                if (row.itemType === 'task') {
                                    nextTaskId = row.data.id;
                                    dispatch({ type: 'SET_ACTIVE_CELL', payload: { taskId: nextTaskId, columnId: nextColId }});
                                    dispatch({ type: 'SELECT_TASK', payload: { taskId: nextTaskId }});
                                }
                            }
                            break;
                        }
                        case 'ArrowUp': {
                            let nextRowIndex = activeRowIndex - 1;
                            while(renderableRows[nextRowIndex] && renderableRows[nextRowIndex].itemType === 'group') {
                                nextRowIndex--;
                            }
                            if (nextRowIndex >= 0) {
                                const row = renderableRows[nextRowIndex];
                                if (row.itemType === 'task') {
                                    nextTaskId = row.data.id;
                                    dispatch({ type: 'SET_ACTIVE_CELL', payload: { taskId: nextTaskId, columnId: nextColId }});
                                    dispatch({ type: 'SELECT_TASK', payload: { taskId: nextTaskId }});
                                }
                            }
                            break;
                        }
                        case 'ArrowRight': {
                            if (activeColIndex < orderedVisibleColumns.length - 1) {
                                nextColId = orderedVisibleColumns[activeColIndex + 1].id;
                                dispatch({ type: 'SET_ACTIVE_CELL', payload: { taskId: nextTaskId, columnId: nextColId }});
                            }
                            break;
                        }
                        case 'ArrowLeft': {
                            if (activeColIndex > 0) {
                                nextColId = orderedVisibleColumns[activeColIndex - 1].id;
                                dispatch({ type: 'SET_ACTIVE_CELL', payload: { taskId: nextTaskId, columnId: nextColId }});
                            }
                            break;
                        }
                    }
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [renderableRows, dispatch, getCellValueForEditing]);

    const [draggedIds, setDraggedIds] = React.useState<string[] | null>(null);
    const [dropIndicator, setDropIndicator] = React.useState<{ targetId: string; position: 'top' | 'bottom' | 'child' } | null>(null);

    const [draggedColId, setDraggedColId] = React.useState<string | null>(null);
    const [dropColIndicator, setDropColIndicator] = React.useState<{ targetId: string } | null>(null);
    const [editingColumn, setEditingColumn] = React.useState<ColumnSpec | null>(null);
    
    const handleSelectTask = (e: React.MouseEvent, taskId: string) => {
        dispatch({ type: 'SELECT_TASK', payload: { taskId, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey } });
    };

    const handleToggle = React.useCallback((e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      dispatch({ type: 'TOGGLE_TASK_COLLAPSE', payload: { taskId } });
    }, [dispatch]);

    const onStopEditing = useCallback(() => {
        dispatch({ type: 'STOP_EDITING_CELL' });
    }, [dispatch]);

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

        if (x > indentThreshold && grouping.length === 0) { // Only allow DnD nesting if not grouping
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
        
        if (!dropIndicator || !draggedIds || grouping.length > 0) { // Disable drop when grouping
             setDraggedIds(null);
             setDropIndicator(null);
            return;
        };

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
    
    const handleUpdateColumn = (config: ColumnConfig) => {
        if (editingColumn) {
            dispatch({ type: 'UPDATE_COLUMN', payload: { id: editingColumn.id, ...config } });
        }
    };

    const handleRemoveColumn = (columnId: string) => {
        // TODO: Add confirmation dialog
        dispatch({ type: 'REMOVE_COLUMN', payload: { columnId }});
    }

    const resourceMap = React.useMemo(() => new Map(resources.map(r => [r.id, r.name])), [resources]);

    const orderedAndVisibleColumns = React.useMemo(() => {
        return columns.filter(c => visibleColumns.includes(c.id));
    }, [columns, visibleColumns]);

    const defaultCalendar = React.useMemo(() => calendars.find(c => c.id === defaultCalendarId) || calendars[0] || null, [calendars, defaultCalendarId]);

    return (
        <>
        <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
            <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]" onScroll={onScroll}>
                <Table className="w-auto">
                    <colgroup>
                        {orderedAndVisibleColumns.map((col) => (
                            <col key={col.id} style={{ width: `${col.width}px` }} />
                        ))}
                    </colgroup>
                    <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                            {orderedAndVisibleColumns.map(column => {
                                return (
                                    <TableHead 
                                        key={column.id} 
                                        draggable={grouping.length === 0}
                                        onDragStart={(e) => handleColDragStart(e, column.id)}
                                        onDragOver={(e) => handleColDragOver(e, column.id)}
                                        onDragLeave={handleColDragLeave}
                                        onDrop={(e) => handleColDrop(e, column.id)}
                                        onDragEnd={handleColDragEnd}
                                        className={cn(
                                            "relative group/header select-none overflow-hidden",
                                            draggedColId === column.id && "opacity-50",
                                            dropColIndicator?.targetId === column.id && "border-l-2 border-primary"
                                        )}
                                    >
                                      <div className="flex items-center justify-between h-full">
                                        <span>{column.name}</span>
                                        <div className="flex items-center">
                                            {column.id.startsWith('custom-') && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/header:opacity-100 data-[state=open]:opacity-100">
                                                            <Settings2 className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => setEditingColumn(column)}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            <span>Edit Column</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator/>
                                                        <DropdownMenuItem onClick={() => handleRemoveColumn(column.id)} className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            <span>Delete Column</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                            <div 
                                                className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-border opacity-0 group-hover/header:opacity-100"
                                                onMouseDown={(e) => handleResizeMouseDown(e, column.id)}
                                                onTouchStart={(e) => handleResizeTouchStart(e, column.id)}
                                            />
                                        </div>
                                      </div>
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody onDrop={handleDrop} onDragEnd={handleDragEnd} onDragLeave={handleDragLeave}>
                        {renderableRows.map((item) => {
                            if (item.itemType === 'group') {
                                return (
                                    <TableRow key={item.id} className="bg-muted/50 hover:bg-muted/50 font-semibold">
                                        <TableCell colSpan={orderedAndVisibleColumns.length} className="p-0">
                                            <div 
                                                className="flex items-center gap-2 h-full"
                                                style={{ paddingLeft: `${item.level * 1.5}rem`}}
                                            >
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleGroup(item.id)}>
                                                    {item.isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </Button>
                                                <span>{item.name} ({item.childCount})</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            }

                            // It's a task row
                            const task = item.data;
                            return (
                                <TableRow
                                    key={task.id}
                                    draggable={grouping.length === 0}
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
                                        !draggedIds?.includes(task.id) && dropIndicator?.targetId === task.id && grouping.length === 0 && {
                                            "border-t-2 border-primary": dropIndicator.position === 'top',
                                            "border-b-2 border-primary": dropIndicator.position === 'bottom',
                                            "bg-primary/20": dropIndicator.position === 'child',
                                        }
                                    )}
                                >
                                    {orderedAndVisibleColumns.map(column => {
                                        const isEditing = editingCell?.taskId === task.id && editingCell?.columnId === column.id;
                                        return (
                                            <TableCell 
                                                key={column.id} 
                                                data-density={uiDensity}
                                                className={cn(
                                                    "font-medium truncate p-0",
                                                    "data-[density=large]:h-12 data-[density=medium]:h-10 data-[density=compact]:h-8",
                                                    activeCell?.taskId === task.id && activeCell?.columnId === column.id && !isEditing && "ring-2 ring-inset ring-primary"
                                                )}
                                                onClick={(e) => {
                                                    dispatch({ type: 'SET_ACTIVE_CELL', payload: { taskId: task.id, columnId: column.id } });
                                                    handleSelectTask(e, task.id);
                                                }}
                                                onDoubleClick={() => {
                                                    const value = getCellValueForEditing(task.id, column.id);
                                                    dispatch({
                                                        type: 'START_EDITING_CELL',
                                                        payload: { taskId: task.id, columnId: column.id, initialValue: value }
                                                    });
                                                }}
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
                                                <TaskCellRenderer
                                                        task={task}
                                                        column={column}
                                                        dispatch={dispatch}
                                                        links={links}
                                                        idToWbsMap={idToWbsMap}
                                                        resourceMap={resourceMap}
                                                        assignments={assignments}
                                                        handleToggle={handleToggle}
                                                        displayLevel={item.displayLevel}
                                                        grouping={grouping}
                                                        tasks={tasks}
                                                        defaultCalendar={defaultCalendar}
                                                        isEditing={isEditing}
                                                        editingInitialValue={editingCell?.initialValue}
                                                        onStopEditing={onStopEditing}
                                                />
                                                </div>
                                            </TableCell>
                                        )
                                    })}
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </ScrollAreaPrimitive.Viewport>
            <ScrollBar orientation="vertical" />
            <ScrollBar orientation="horizontal" />
            <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>
        <ColumnConfigDialog
            open={!!editingColumn}
            onOpenChange={() => setEditingColumn(null)}
            onSave={handleUpdateColumn}
            column={editingColumn}
        />
        </>
    );
}
