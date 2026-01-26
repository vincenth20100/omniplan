'use client';
import type { ProjectState, UiDensity, Task, Link, ColumnSpec, Assignment, Resource } from '@/lib/types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TaskTable } from './task-table';
import { Timeline } from './timeline';
import React, { useRef, useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { addDays, min } from 'date-fns';

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

    const { tasks, links, resources, assignments, columns, grouping } = projectState;
    const resourceMap = useMemo(() => new Map(resources.map(r => [r.id, r.name])), [resources]);

    const getTaskPropertyValue = useCallback((task: Task, columnId: string): string => {
        const column = columns.find(c => c.id === columnId);
        if (!column) return 'None';
        
        switch (column.id) {
            case 'resourceNames': {
                const taskAssignments = assignments.filter(a => a.taskId === task.id);
                const resourceNames = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
                return resourceNames || 'Unassigned';
            }
            case 'constraintType': 
                return task.constraintType || 'None';
            case 'cost': 
                return String(task.cost || 0);
            case 'duration':
                return `${task.duration} day(s)`;
            case 'start':
                return format(task.start, 'MMM d, yyyy');
            case 'finish':
                return format(task.finish, 'MMM d, yyyy');
            case 'percentComplete':
                return `${task.percentComplete}%`;
            case 'constraintDate':
                return task.constraintDate ? format(task.constraintDate, 'MMM d, yyyy') : 'None';
            default:
                if (column.id.startsWith('custom-')) {
                    return String(task.customAttributes?.[column.id] || 'None');
                }
                return 'N/A';
        }
    }, [columns, assignments, resourceMap]);

    const renderableRows: RenderableRow[] = useMemo(() => {
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        
        const getVisibleHierarchicalTasks = (): Task[] => {
            return tasks.filter(task => {
                if (!task.parentId) return true;
                let parent = taskMap.get(task.parentId);
                while(parent) {
                    if (parent.isCollapsed) return false;
                    parent = taskMap.get(parent.parentId || '');
                }
                return true;
            });
        };
        
        if (grouping.length === 0) {
            return getVisibleHierarchicalTasks().map(task => ({ itemType: 'task', data: task, displayLevel: task.level || 0 }));
        }

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
        
        groupRecursively(tasks, 0);
        
        return finalRows;

    }, [tasks, grouping, collapsedGroups, columns, assignments, getTaskPropertyValue, resourceMap]);
    
    const timelineTasks = useMemo(() => 
        renderableRows.filter((r): r is TaskRow => r.itemType === 'task').map(r => r.data)
    , [renderableRows]);

    const timelineLinks = useMemo(() => {
        const visibleTaskIds = new Set(timelineTasks.map(t => t.id));
        return links.filter(l => visibleTaskIds.has(l.source) && visibleTaskIds.has(l.target));
    }, [timelineTasks, links]);

    return (
        <div className="border rounded-lg overflow-hidden h-full flex flex-col bg-card">
            <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={50} minSize={20}>
                    <TaskTable 
                        projectState={projectState}
                        renderableRows={renderableRows}
                        dispatch={dispatch} 
                        viewportRef={tableViewportRef}
                        onScroll={() => handleVerticalScroll('table')}
                        uiDensity={uiDensity}
                        onToggleGroup={handleToggleGroup}
                    />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>
                    <Timeline 
                        renderableRows={renderableRows}
                        links={timelineLinks}
                        dispatch={dispatch}
                        selectedTaskIds={projectState.selectedTaskIds}
                        viewportRef={timelineViewportRef}
                        onScroll={() => handleVerticalScroll('timeline')}
                        uiDensity={uiDensity}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
