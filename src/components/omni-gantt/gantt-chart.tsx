'use client';
import type { ProjectState, UiDensity, Task, Link, ColumnSpec, Assignment, Resource, Filter, Calendar, GanttSettings, Baseline } from '@/lib/types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TaskTable } from './task-table';
import { Timeline } from './timeline';
import React, { useRef, useCallback, useMemo, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { addDays, min } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

export type GroupRow = {
    itemType: 'group';
    id: string;
    level: number;
    name: string;
    childCount: number;
    isCollapsed: boolean;
};

export type TaskRow = {
    itemType: 'task';
    data: Task;
    displayLevel: number;
};

export type RenderableRow = GroupRow | TaskRow;

export function GanttChart({ projectState, dispatch, uiDensity }: { projectState: ProjectState, dispatch: any, uiDensity: UiDensity }) {
    const tableViewportRef = useRef<HTMLDivElement>(null);
    const timelineViewportRef = useRef<HTMLDivElement>(null);
    const isSyncingVerticalScroll = useRef(false);
    const isMobile = useIsMobile();

    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const handleToggleGroup = (groupId: string) => {
        setCollapsedGroups(prev => ({...prev, [groupId]: !prev[groupId]}));
    }

    const handleVerticalScroll = useCallback((scroller: 'table' | 'timeline') => {
        if (isSyncingVerticalScroll.current) {
            isSyncingVerticalScroll.current = false;
            return;
        }

        isSyncingVerticalScroll.current = true;
        if (scroller === 'table' && tableViewportRef.current && timelineViewportRef.current) {
            timelineViewportRef.current.scrollTop = tableViewportRef.current.scrollTop;
        } else if (scroller === 'timeline' && tableViewportRef.current && timelineViewportRef.current) {
            tableViewportRef.current.scrollTop = timelineViewportRef.current.scrollTop;
        }
    }, []);

    const { tasks, links, resources, assignments, columns, grouping, filters, calendars, defaultCalendarId, ganttSettings, baselines, visibleColumns, selectedTaskIds, focusCell, anchorCell, editingCell, selectionMode } = projectState;
    const defaultCalendar = useMemo(() => calendars.find(c => c.id === defaultCalendarId) || (calendars.length > 0 ? calendars[0] : null), [calendars, defaultCalendarId]);
    const resourceMap = useMemo(() => new Map(resources.map(r => [r.id, r.name])), [resources]);

    const getRawTaskPropertyValue = useCallback((task: Task, columnId: string): any => {
        const column = columns.find(c => c.id === columnId);
        if (!column) return null;
        
        switch (column.id) {
            case 'resourceNames': {
                const taskAssignments = assignments.filter(a => a.taskId === task.id);
                const resourceNames = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
                return resourceNames || null;
            }
            case 'constraintType': 
                return task.constraintType || null;
            case 'cost': 
                return task.cost || 0;
            case 'duration':
                return task.duration;
            case 'start':
                return task.start;
            case 'finish':
                return task.finish;
            case 'percentComplete':
                return task.percentComplete;
            case 'constraintDate':
                return task.constraintDate || null;
            case 'name':
                return task.name;
            default:
                if (column.id.startsWith('custom-')) {
                    return task.customAttributes?.[column.id] || null;
                }
                return null;
        }
    }, [columns, assignments, resourceMap]);

    const getTaskPropertyValue = useCallback((task: Task, columnId: string): string => {
        const rawValue = getRawTaskPropertyValue(task, columnId);
        const column = columns.find(c => c.id === columnId);
        if (rawValue === null || rawValue === undefined) return 'None';

        const dateColumns = ['start', 'finish', 'constraintDate'];
        if (dateColumns.includes(columnId) && rawValue) {
            return format(new Date(rawValue), 'MMM d, yyyy');
        }

        if (column?.id === 'duration') return `${rawValue} day(s)`;
        if (column?.id === 'percentComplete') return `${rawValue}%`;
        
        return String(rawValue);
    }, [getRawTaskPropertyValue, columns]);

    const renderableRows: RenderableRow[] = useMemo(() => {
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const checkCondition = (rawValue: any, operator: string, filterValue: any, columnType?: 'text' | 'number' | 'selection' | 'date'): boolean => {
            if (operator === 'is_empty') {
                return rawValue === null || rawValue === undefined || rawValue === '';
            }
            if (operator === 'is_not_empty') {
                return rawValue !== null && rawValue !== undefined && rawValue !== '';
            }
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                return false;
            }
        
            switch (columnType) {
                case 'number': {
                    const numValue = parseFloat(rawValue);
                    const numFilterValue = parseFloat(filterValue);
                    if (isNaN(numValue) || isNaN(numFilterValue)) return false;
                    switch (operator) {
                        case 'equals': return numValue === numFilterValue;
                        case 'not_equals': return numValue !== numFilterValue;
                        case 'gt': return numValue > numFilterValue;
                        case 'lt': return numValue < numFilterValue;
                        case 'gte': return numValue >= numFilterValue;
                        case 'lte': return numValue <= numFilterValue;
                        default: return false;
                    }
                }
                case 'date': {
                    const dateValue = startOfDay(new Date(rawValue)).getTime();
                    const dateFilterValue = startOfDay(new Date(filterValue)).getTime();
                    if (isNaN(dateValue) || isNaN(dateFilterValue)) return false;
                     switch (operator) {
                        case 'equals': return dateValue === dateFilterValue;
                        case 'not_equals': return dateValue !== dateFilterValue;
                        case 'gt': return dateValue > dateFilterValue;
                        case 'lt': return dateValue < dateFilterValue;
                        case 'gte': return dateValue >= dateFilterValue;
                        case 'lte': return dateValue <= dateFilterValue;
                        default: return false;
                    }
                }
                case 'selection': {
                     switch (operator) {
                        case 'equals': return rawValue === filterValue;
                        case 'not_equals': return rawValue !== filterValue;
                        default: return false;
                     }
                }
                case 'text':
                default: {
                    const textValue = String(rawValue).toLowerCase();
                    const textFilterValue = String(filterValue).toLowerCase();
                     switch (operator) {
                        case 'contains': return textValue.includes(textFilterValue);
                        case 'not_contains': return !textValue.includes(textFilterValue);
                        case 'equals': return textValue === textFilterValue;
                        case 'not_equals': return textValue !== textFilterValue;
                        default: return false;
                     }
                }
            }
        }

        let filteredTaskIds = new Set(tasks.map(t => t.id));

        if (filters && filters.length > 0) {
            const matchingTaskIds = new Set<string>();

            tasks.forEach(task => {
                if (task.isSummary) return;

                const isMatch = filters.every(filter => {
                    const rawValue = getRawTaskPropertyValue(task, filter.columnId);
                    const column = columns.find(c => c.id === filter.columnId);
                    
                    let type = column?.type;
                    if (['start', 'finish', 'constraintDate'].includes(filter.columnId)) {
                        type = 'date';
                    }

                    return checkCondition(rawValue, filter.operator, filter.value, type);
                });
                
                if (isMatch) {
                    matchingTaskIds.add(task.id);
                }
            });

            filteredTaskIds = new Set();
            matchingTaskIds.forEach(id => {
                let current = taskMap.get(id);
                while(current) {
                    filteredTaskIds.add(current.id);
                    current = current.parentId ? taskMap.get(current.parentId) : undefined;
                }
            });
        }
        
        const finalTasks = tasks.filter(t => filteredTaskIds.has(t.id));

        const getVisibleHierarchicalTasks = (): Task[] => {
            return finalTasks.filter(task => {
                if (!task.parentId) return true;
                let parent = taskMap.get(task.parentId);
                while(parent) {
                    if (parent.isCollapsed && filteredTaskIds.has(parent.id)) return false;
                    parent = taskMap.get(parent.parentId || '');
                }
                return true;
            });
        };
        
        if (grouping.length > 0) {
            const finalRows: RenderableRow[] = [];
            const groupRecursively = (tasksToGroup: Task[], groupLevel: number) => {
                if (groupLevel >= grouping.length) {
                    tasksToGroup.forEach(task => {
                        finalRows.push({ itemType: 'task', data: task, displayLevel: groupLevel });
                    });
                    return;
                }
    
                const groupField = grouping[groupLevel];
                const grouped = new Map<string, Task[]>();
    
                for (const task of tasksToGroup) {
                    const groupValue = getTaskPropertyValue(task, groupField);
                    if (!grouped.has(groupValue)) {
                        grouped.set(groupValue, []);
                    }
                    grouped.get(groupValue)!.push(task);
                }
    
                const sortedGroupKeys = Array.from(grouped.keys()).sort();
    
                for (const key of sortedGroupKeys) {
                    const groupTasks = grouped.get(key)!;
                    const groupColumn = columns.find(c => c.id === groupField);
                    const groupId = `group-${groupLevel}-${key}`;
                    const isCollapsed = collapsedGroups[groupId] || false;
    
                    finalRows.push({
                        itemType: 'group',
                        name: `${groupColumn?.name}: ${key}`,
                        level: groupLevel,
                        id: groupId,
                        childCount: groupTasks.length,
                        isCollapsed: isCollapsed,
                    });
                    
                    if (!isCollapsed) {
                        groupRecursively(groupTasks, groupLevel + 1);
                    }
                }
            }
            groupRecursively(finalTasks, 0);
            return finalRows;
        } else {
             return getVisibleHierarchicalTasks().map(task => ({ itemType: 'task', data: task, displayLevel: task.level || 0 }));
        }
    }, [tasks, filters, grouping, collapsedGroups, getRawTaskPropertyValue, getTaskPropertyValue, columns, assignments, resourceMap]);
    
    const timelineTasks = useMemo(() => 
        renderableRows.filter((r): r is TaskRow => r.itemType === 'task').map(r => r.data)
    , [renderableRows]);

    const timelineLinks = useMemo(() => {
        const visibleTaskIds = new Set(timelineTasks.map(t => t.id));
        return links.filter(l => visibleTaskIds.has(l.source) && visibleTaskIds.has(l.target));
    }, [timelineTasks, links]);

    const taskTableComponent = (
        <TaskTable 
            tasks={tasks}
            links={links}
            resources={resources}
            assignments={assignments}
            columns={columns}
            visibleColumns={visibleColumns}
            grouping={grouping}
            selectedTaskIds={selectedTaskIds}
            focusCell={focusCell}
            anchorCell={anchorCell}
            editingCell={editingCell}
            selectionMode={selectionMode}
            calendars={calendars}
            defaultCalendarId={defaultCalendarId}
            ganttSettings={ganttSettings}
            baselines={baselines}
            renderableRows={renderableRows}
            dispatch={dispatch} 
            viewportRef={tableViewportRef}
            onScroll={() => handleVerticalScroll('table')}
            uiDensity={uiDensity}
            onToggleGroup={handleToggleGroup}
        />
    );

    const timelineComponent = (
        <Timeline 
            allTasks={tasks}
            renderableRows={renderableRows}
            links={timelineLinks}
            dispatch={dispatch}
            selectedTaskIds={projectState.selectedTaskIds}
            viewportRef={timelineViewportRef}
            onScroll={() => handleVerticalScroll('timeline')}
            uiDensity={uiDensity}
            defaultCalendar={defaultCalendar}
            ganttSettings={ganttSettings}
            baselines={baselines}
        />
    );

    if (isMobile) {
        return (
            <div className="border rounded-lg overflow-x-auto h-full flex flex-row bg-card">
                <div className="shrink-0">
                    {taskTableComponent}
                </div>
                <div className="flex-1 min-w-0">
                    {timelineComponent}
                </div>
            </div>
        );
    }
    

    return (
        <div className="border rounded-lg overflow-hidden h-full flex flex-col bg-card">
            <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={50} minSize={20}>
                    {taskTableComponent}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>
                    {timelineComponent}
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
