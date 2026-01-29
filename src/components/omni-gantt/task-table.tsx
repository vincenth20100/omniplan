'use client';
import type { Task, ColumnSpec, UiDensity, Link, Resource, Assignment, ProjectState, Calendar, GanttSettings, Baseline, SelectionMode } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flame, ChevronRight, ChevronDown, Settings2, Pencil, Trash2, MessageSquare, ArrowRight, Calendar as CalendarIndicatorIcon, Flag, GripVertical } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useMemo } from 'react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { calendarService } from '@/lib/calendar';

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
    onStopEditing,
    dateFormat,
    ganttSettings,
    baselines,
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
    dateFormat: string;
    ganttSettings: GanttSettings;
    baselines: Baseline[];
}) => {
    const isEditable = !task.isSummary || grouping.length > 0;

    const comparisonBaseline = React.useMemo(() => {
        if (!ganttSettings.comparisonBaselineId) return null;
        return baselines.find(b => b.id === ganttSettings.comparisonBaselineId);
    }, [baselines, ganttSettings.comparisonBaselineId]);

    const baselineTask = React.useMemo(() => {
        if (!comparisonBaseline) return null;
        return comparisonBaseline.tasks.find(bt => bt.id === task.id);
    }, [comparisonBaseline, task.id]);


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
                    {task.deadlineMissed && task.deadline && <Flag className="h-4 w-4 text-destructive flex-shrink-0" title={`Deadline missed. Deadline was ${format(task.deadline, dateFormat)}`} />}
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
        case 'status': {
            if (task.isSummary) return null;
            return (
                <EditableSelectCell
                    value={task.status || 'To Do'}
                    onSave={(newValue) => {
                        if (newValue) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, status: newValue } });
                        }
                    }}
                    options={[
                        { value: 'To Do', label: 'To Do' },
                        { value: 'In Progress', label: 'In Progress' },
                        { value: 'Done', label: 'Done' },
                    ]}
                    placeholder="Select Status"
                />
            );
        }
        case 'resourceNames': {
            if (task.isSummary && grouping.length === 0) return null;
            const taskAssignments = assignments.filter(a => a.taskId === task.id);
            const resourceNames = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
            return <div className="truncate">{resourceNames}</div>;
        }
        case 'predecessors': {
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
            if (!isEditable) { // This means it's a summary task and we are not in a grouped view
                const unit = ganttSettings?.summaryDurationUnit || 'day';
                let displayValue = '';
                if (task.duration) {
                    if (unit === 'week') {
                        const weeks = Math.round((task.duration / 5) * 10) / 10;
                        displayValue = `${weeks}w`;
                    } else if (unit === 'month') {
                        const months = Math.round((task.duration / 21.75) * 10) / 10;
                        displayValue = `${months}m`;
                    } else { // 'day'
                        displayValue = `${task.duration}d`;
                    }
                }
                return <div className="text-right pr-4">{displayValue}</div>;
            }

            return (
                <EditableCell
                    value={formatDuration(task.duration, task.durationUnit)}
                    onSave={(newValue) => {
                        const parsed = parseDuration(newValue, task.durationUnit);
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
            if (!isEditable) return <>{format(task.start, dateFormat)}</>;

            return (
                <EditableDateCell
                    value={task.start}
                    onSave={(newDate) => {
                        if (newDate) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, start: newDate } });
                        }
                    }}
                    calendar={defaultCalendar}
                    dateFormat={dateFormat}
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
                />
            );
        }
        case 'finish': {
            if (!isEditable) return <>{format(task.finish, dateFormat)}</>;

            return (
                <EditableDateCell
                    value={task.finish}
                    onSave={(newDate) => {
                        if (newDate) {
                            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, finish: newDate } });
                        }
                    }}
                    calendar={defaultCalendar}
                    dateFormat={dateFormat}
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
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
                    dateFormat={dateFormat}
                    isEditing={isEditing}
                    initialValue={editingInitialValue}
                    onStopEditing={onStopEditing}
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
        case 'baselineDuration': {
            if (!baselineTask) return null;
            return <div className="text-right pr-4">{formatDuration(baselineTask.duration, baselineTask.durationUnit)}</div>;
        }
        case 'baselineStart': {
            if (!baselineTask) return null;
            return <>{format(baselineTask.start, dateFormat)}</>;
        }
        case 'baselineFinish': {
            if (!baselineTask) return null;
            return <>{format(baselineTask.finish, dateFormat)}</>;
        }
        case 'finishVariance': {
            if (!baselineTask || !defaultCalendar) return null;
            const variance = calendarService.getWorkingDaysDuration(baselineTask.finish, task.finish, defaultCalendar);
            const textClass = variance > 0 ? 'text-destructive' : variance < 0 ? 'text-chart-2' : '';
            return <div className={cn("text-right pr-4", textClass)}>{variance !== 0 ? `${variance > 0 ? '+' : ''}${variance}d` : '0d'}</div>;
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
    tasks,
    links,
    resources,
    assignments,
    columns,
    visibleColumns,
    grouping,
    selectedTaskIds,
    focusCell,
    anchorCell,
    editingCell,
    selectionMode,
    calendars,
    defaultCalendarId,
    ganttSettings,
    baselines,
    renderableRows,
    dispatch, 
    viewportRef,
    onScroll,
    uiDensity,
    onToggleGroup,
}: { 
    tasks: Task[];
    links: Link[];
    resources: Resource[];
    assignments: Assignment[];
    columns: ColumnSpec[];
    visibleColumns: string[];
    grouping: string[];
    selectedTaskIds: string[];
    focusCell: { taskId: string, columnId: string } | null;
    anchorCell: { taskId: string, columnId: string } | null;
    editingCell: { taskId: string, columnId: string, initialValue?: string } | null;
    selectionMode: SelectionMode;
    calendars: Calendar[];
    defaultCalendarId: string | null;
    ganttSettings: GanttSettings;
    baselines: Baseline[];
    renderableRows: RenderableRow[],
    dispatch: any, 
    viewportRef: React.RefObject<HTMLDivElement>,
    onScroll: () => void,
    uiDensity: UiDensity,
    onToggleGroup: (groupId: string) => void,
}) {
    const stateRef = useRef({ tasks, links, columns, visibleColumns, focusCell, editingCell, selectedTaskIds, grouping });
    const isMobile = useIsMobile();

    useEffect(() => {
        stateRef.current = { tasks, links, columns, visibleColumns, focusCell, editingCell, selectedTaskIds, grouping };
    }, [tasks, links, columns, visibleColumns, focusCell, editingCell, selectedTaskIds, grouping]);

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
            const { focusCell: activeCell, columns, visibleColumns, editingCell } = stateRef.current;

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
              const target = event.target as HTMLElement;
              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                  return;
              }
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
                const target = event.target as HTMLElement;
                // Do not trigger "type-to-edit" if the event originates from an element that already accepts text input.
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }
                event.preventDefault();
                dispatch({
                    type: 'START_EDITING_CELL',
                    payload: { ...activeCell, initialValue: event.key }
                });
                return;
            }

            if ((event.key === 'Backspace' || event.key === 'Delete') && activeCell && !isEditing) {
                const target = event.target as HTMLElement;
                // Do not trigger "type-to-edit" if the event originates from an element that already accepts text input.
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }
                event.preventDefault();
                
                const { taskId, columnId } = activeCell;

                if (event.key === 'Delete') {
                    // If WBS column is active, delete the whole task
                    if (columnId === 'wbs') {
                        dispatch({ type: 'REMOVE_TASK' });
                        return; // Action handled
                    }
                    // If relationship columns, just clear the content
                    if (columnId === 'predecessors' || columnId === 'successors') {
                        dispatch({ type: 'UPDATE_RELATIONSHIPS', payload: { taskId, field: columnId as 'predecessors' | 'successors', value: '' } });
                        return; // Action handled
                    }
                }

                // For Backspace on any column, or Delete on other columns, start editing with empty content
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
                            }
                        }
                        break;
                    }
                    case 'ArrowRight': {
                        if (activeColIndex < orderedVisibleColumns.length - 1) {
                            nextColId = orderedVisibleColumns[activeColIndex + 1].id;
                        }
                        break;
                    }
                    case 'ArrowLeft': {
                        if (activeColIndex > 0) {
                            nextColId = orderedVisibleColumns[activeColIndex - 1].id;
                        }
                        break;
                    }
                }

                if (nextTaskId !== activeCell.taskId || nextColId !== activeCell.columnId) {
                     dispatch({
                        type: 'SET_ACTIVE_AND_SELECT_TASK',
                        payload: {
                            taskId: nextTaskId,
                            columnId: nextColId,
                            shiftKey: event.shiftKey,
                            ctrlKey: event.ctrlKey,
                        }
                    });
                }
            }
        };

        const handleCopy = (e: ClipboardEvent) => {
            const { selectedTaskIds, tasks, links, editingCell } = stateRef.current;
            if (selectedTaskIds.length === 0 || editingCell) return;

            e.preventDefault();

            const taskMap = new Map(tasks.map(t => [t.id, t]));
            const tasksToCopyIds = new Set<string>();

            const getChildrenRecursive = (parentId: string) => {
                tasks.forEach(t => {
                    if (t.parentId === parentId) {
                        tasksToCopyIds.add(t.id);
                        if (t.isSummary) {
                            getChildrenRecursive(t.id);
                        }
                    }
                });
            };

            const sortedSelectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
            sortedSelectedTasks.forEach(task => {
                tasksToCopyIds.add(task.id);
                if (task.isSummary) {
                    getChildrenRecursive(task.id);
                }
            });
            
            const tasksToCopy = tasks
                .filter(t => tasksToCopyIds.has(t.id))
                .map(t => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { isCritical, totalFloat, lateStart, lateFinish, ...rest } = t;
                    return rest;
                });
            
            const linksToCopy = links.filter(l => tasksToCopyIds.has(l.source) && tasksToCopyIds.has(l.target));

            const data = {
                type: 'omniplan-tasks',
                tasks: tasksToCopy,
                links: linksToCopy
            };
            
            e.clipboardData?.setData('text/plain', JSON.stringify(data));
        };

        const handlePaste = (e: ClipboardEvent) => {
            const { editingCell, focusCell } = stateRef.current;
            if (editingCell) return; // Don't handle paste when editing a cell

            const pastedData = e.clipboardData?.getData('text/plain');
            if (pastedData) {
                e.preventDefault();
                dispatch({ 
                    type: 'ADD_TASKS_FROM_PASTE', 
                    payload: { data: pastedData, activeCell: focusCell }
                });
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('copy', handleCopy);
        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('copy', handleCopy);
            window.removeEventListener('paste', handlePaste);
        };
    }, [renderableRows, dispatch, getCellValueForEditing]);

    const [draggedIds, setDraggedIds] = React.useState<string[] | null>(null);
    const [dropIndicator, setDropIndicator] = React.useState<{ targetId: string; position: 'top' | 'bottom' | 'child' } | null>(null);

    const [draggedColId, setDraggedColId] = React.useState<string | null>(null);
    const [dropColIndicator, setDropColIndicator] = React.useState<{ targetId: string } | null>(null);
    const [editingColumn, setEditingColumn] = React.useState<ColumnSpec | null>(null);

    const orderedAndVisibleColumns = React.useMemo(() => {
        return columns.filter(c => visibleColumns.includes(c.id));
    }, [columns, visibleColumns]);

    const taskIdToVisibleIndex = React.useMemo(() => {
        const map = new Map<string, number>();
        let taskCount = 0;
        renderableRows.forEach(r => {
             if (r.itemType === 'task') {
                 map.set(r.data.id, taskCount++);
             }
        });
        return map;
    }, [renderableRows]);

    const selectionRange = useMemo(() => {
        if (selectionMode !== 'cell' || !anchorCell || !focusCell) return null;

        const r1 = taskIdToVisibleIndex.get(anchorCell.taskId);
        const r2 = taskIdToVisibleIndex.get(focusCell.taskId);

        const c1 = orderedAndVisibleColumns.findIndex(c => c.id === anchorCell.columnId);
        const c2 = orderedAndVisibleColumns.findIndex(c => c.id === focusCell.columnId);

        if (r1 === undefined || r2 === undefined || c1 === -1 || c2 === -1) return null;

        return {
            rowStart: Math.min(r1, r2),
            rowEnd: Math.max(r1, r2),
            colStart: Math.min(c1, c2),
            colEnd: Math.max(c1, c2),
        };
    }, [selectionMode, anchorCell, focusCell, taskIdToVisibleIndex, orderedAndVisibleColumns]);

    const handleToggle = React.useCallback((e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      dispatch({ type: 'TOGGLE_TASK_COLLAPSE', payload: { taskId } });
    }, [dispatch]);

    const onStopEditing = useCallback(() => {
        dispatch({ type: 'STOP_EDITING_CELL' });
    }, [dispatch]);

    // Row Drag & Drop
    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        let sourceIds = [...selectedTaskIds];

        if (selectionMode === 'cell' && selectionRange) {
             const visibleTaskIndex = taskIdToVisibleIndex.get(taskId);

             if (visibleTaskIndex !== undefined && visibleTaskIndex >= selectionRange.rowStart && visibleTaskIndex <= selectionRange.rowEnd) {
                 const tasksInRange: string[] = [];
                 let count = 0;
                 renderableRows.forEach(r => {
                     if (r.itemType === 'task') {
                         if (count >= selectionRange.rowStart && count <= selectionRange.rowEnd) {
                             tasksInRange.push(r.data.id);
                         }
                         count++;
                     }
                 });
                 sourceIds = tasksInRange;
             } else {
                 sourceIds = [taskId];
             }
        } else {
            if (!sourceIds.includes(taskId)) {
                sourceIds = [taskId];
                dispatch({ type: 'SELECT_TASK', payload: { taskId, ctrlKey: false, shiftKey: false }});
            }
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

    const defaultCalendar = React.useMemo(() => calendars.find(c => c.id === defaultCalendarId) || calendars[0] || null, [calendars, defaultCalendarId]);
    const dateFormat = ganttSettings.dateFormat || 'MMM d, yyyy';


    return (
        <>
        <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
            <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]" onScroll={onScroll}>
                <div className="pb-40">
                <Table className="w-auto">
                    <colgroup>
                        <col style={{ width: '40px' }} />
                        {orderedAndVisibleColumns.map((col) => (
                            <col key={col.id} style={{ width: `${col.width}px` }} />
                        ))}
                    </colgroup>
                    <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                            <TableHead className="p-0"></TableHead>
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
                        {renderableRows.map((item, rowIndex) => {
                            if (item.itemType === 'group') {
                                return (
                                    <TableRow key={item.id} className="bg-muted/50 hover:bg-muted/50 font-semibold">
                                        <TableCell colSpan={orderedAndVisibleColumns.length + 1} className="p-0">
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
                            const level = task.level || 0;
                            const levelClass = level === 0 ? 'bg-task-row-level-0' : level === 1 ? 'bg-task-row-level-1' : 'bg-task-row-level-2-plus';

                            const visibleTaskIndex = taskIdToVisibleIndex.get(task.id) ?? -1;

                            return (
                                <TableRow
                                    key={task.id}
                                    onDragOver={(e) => handleDragOver(e, task.id)}
                                    data-density={uiDensity}
                                    data-level={level}
                                    className={cn(
                                        levelClass,
                                        "cursor-pointer", 
                                        "transition-all duration-150",
                                        "data-[density=large]:h-12 data-[density=medium]:h-10 data-[density=compact]:h-8",
                                        selectedTaskIds.includes(task.id) && "bg-primary/20",
                                        !selectedTaskIds.includes(task.id) && "hover:bg-muted/50",
                                        draggedIds?.includes(task.id) && "opacity-30",
                                        !draggedIds?.includes(task.id) && dropIndicator?.targetId === task.id && grouping.length === 0 && {
                                            "border-t-2 border-primary": dropIndicator.position === 'top',
                                            "border-b-2 border-primary": dropIndicator.position === 'bottom',
                                            "bg-primary/20": dropIndicator.position === 'child',
                                        }
                                    )}
                                >
                                    <TableCell className="p-0 align-middle">
                                        <div 
                                            draggable={grouping.length === 0}
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            className="flex h-full items-center justify-center cursor-grab text-muted-foreground"
                                        >
                                            <GripVertical className="h-4 w-4" />
                                        </div>
                                    </TableCell>
                                    {orderedAndVisibleColumns.map((column, colIndex) => {
                                        const isEditing = editingCell?.taskId === task.id && editingCell?.columnId === column.id;
                                        
                                        const isCellSelected = selectionMode === 'cell' && selectionRange && visibleTaskIndex !== -1 &&
                                            visibleTaskIndex >= selectionRange.rowStart && visibleTaskIndex <= selectionRange.rowEnd &&
                                            colIndex >= selectionRange.colStart && colIndex <= selectionRange.colEnd;

                                        const isTopEdge = isCellSelected && selectionRange && visibleTaskIndex === selectionRange.rowStart;
                                        const isBottomEdge = isCellSelected && selectionRange && visibleTaskIndex === selectionRange.rowEnd;
                                        const isLeftEdge = isCellSelected && selectionRange && colIndex === selectionRange.colStart;
                                        const isRightEdge = isCellSelected && selectionRange && colIndex === selectionRange.colEnd;

                                        const shadows: string[] = [];
                                        if (isTopEdge) shadows.push('inset 0 2px 0 0 hsl(var(--primary))');
                                        if (isBottomEdge) shadows.push('inset 0 -2px 0 0 hsl(var(--primary))');
                                        if (isLeftEdge) shadows.push('inset 2px 0 0 0 hsl(var(--primary))');
                                        if (isRightEdge) shadows.push('inset -2px 0 0 0 hsl(var(--primary))');

                                        return (
                                            <TableCell 
                                                key={column.id} 
                                                data-density={uiDensity}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, task.id)}
                                                style={{ boxShadow: shadows.join(', ') }}
                                                className={cn(
                                                    "font-medium truncate p-0",
                                                    "data-[density=large]:h-12 data-[density=medium]:h-10 data-[density=compact]:h-8",
                                                    isCellSelected && "bg-primary/10",
                                                    focusCell?.taskId === task.id && focusCell?.columnId === column.id && !isEditing && "ring-2 ring-inset ring-primary"
                                                )}
                                                onClick={(e) => {
                                                    dispatch({
                                                        type: 'SET_ACTIVE_CELL_AND_SELECT_TASK',
                                                        payload: {
                                                            taskId: task.id,
                                                            columnId: column.id,
                                                            ctrlKey: e.ctrlKey,
                                                            shiftKey: e.shiftKey
                                                        }
                                                    });
                                                    if (isMobile) {
                                                        const isAlreadyActive = focusCell?.taskId === task.id && focusCell?.columnId === column.id;
                                                        if (isAlreadyActive && !editingCell) {
                                                            const value = getCellValueForEditing(task.id, column.id);
                                                            dispatch({
                                                                type: 'START_EDITING_CELL',
                                                                payload: { taskId: task.id, columnId: column.id, initialValue: value }
                                                            });
                                                        }
                                                    }
                                                }}
                                                onDoubleClick={() => {
                                                    if (!isMobile) {
                                                        const value = getCellValueForEditing(task.id, column.id);
                                                        dispatch({
                                                            type: 'START_EDITING_CELL',
                                                            payload: { taskId: task.id, columnId: column.id, initialValue: value }
                                                        });
                                                    }
                                                }}
                                            >
                                                <div 
                                                    className={cn(
                                                        "flex items-center h-full",
                                                        "data-[density=large]:px-4 data-[density=large]:text-xs md:text-sm",
                                                        "data-[density=medium]:px-3 data-[density=medium]:text-xs md:text-sm",
                                                        "data-[density=compact]:px-2 data-[density=compact]:text-xs"
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
                                                        dateFormat={dateFormat}
                                                        ganttSettings={ganttSettings}
                                                        baselines={baselines}
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
                </div>
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
