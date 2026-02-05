'use client';
import type { ProjectState, UiDensity, Task, Link, ColumnSpec, Assignment, Resource, Filter, Calendar, GanttSettings, Baseline, RenderableRow, TaskRow } from '@/lib/types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TaskTable } from './task-table';
import { Timeline } from './timeline';
import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { format, startOfDay } from 'date-fns';
import { addDays, min } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useRenderableRows } from '@/hooks/use-renderable-rows';

export function GanttChart({
    projectState,
    dispatch,
    uiDensity,
    projectName,
    disableScroll,
    showTable = true,
    showTimeline = true,
    onOpenHistory
}: {
    projectState: ProjectState,
    dispatch: any,
    uiDensity: UiDensity,
    projectName?: string,
    disableScroll?: boolean,
    showTable?: boolean,
    showTimeline?: boolean,
    onOpenHistory?: () => void
}) {
    const tableViewportRef = useRef<HTMLDivElement>(null);
    const timelineViewportRef = useRef<HTMLDivElement>(null);
    const isSyncingVerticalScroll = useRef(false);
    const isMobile = useIsMobile();
    const [isFixedLeftPanel, setIsFixedLeftPanel] = useState(true);

    useEffect(() => {
        if (isMobile) {
            setIsFixedLeftPanel(false);
        }
    }, [isMobile]);

    const handleToggleGroup = (groupId: string) => {
        dispatch({ type: 'TOGGLE_GROUP', payload: { groupId } });
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

    const { tasks, links, resources, assignments, columns, grouping, filters, calendars, defaultCalendarId, ganttSettings, baselines, visibleColumns, selectedTaskIds, focusCell, anchorCell, editingCell, selectionMode, sortColumn, sortDirection } = projectState;
    const defaultCalendar = useMemo(() => calendars.find(c => c.id === defaultCalendarId) || (calendars.length > 0 ? calendars[0] : null), [calendars, defaultCalendarId]);
    
    const { renderableRows } = useRenderableRows(projectState);
    
    const timelineTasks = useMemo(() => 
        renderableRows.filter((r): r is TaskRow => r.itemType === 'task').map(r => r.data)
    , [renderableRows]);

    const timelineLinks = useMemo(() => {
        const visibleTaskIds = new Set(timelineTasks.map(t => t.id));
        return links.filter(l => visibleTaskIds.has(l.source) && visibleTaskIds.has(l.target));
    }, [timelineTasks, links]);

    const commonTaskTableProps = {
            tasks, links, resources, assignments, columns, visibleColumns, grouping, filters,
            selectedTaskIds, focusCell, anchorCell, editingCell, selectionMode, calendars,
            defaultCalendarId, ganttSettings, baselines, renderableRows, dispatch,
            viewportRef: tableViewportRef,
            onScroll: () => handleVerticalScroll('table'),
            uiDensity, onToggleGroup: handleToggleGroup,
            sortColumn, sortDirection,
            onOpenHistory
    };

    const commonTimelineProps = {
            allTasks: tasks, renderableRows, links: timelineLinks, dispatch,
            selectedTaskIds: projectState.selectedTaskIds,
            viewportRef: timelineViewportRef,
            onScroll: () => handleVerticalScroll('timeline'),
            uiDensity, defaultCalendar, ganttSettings, baselines,
            projectColors: projectState.projectColors,
            projectTextColors: projectState.projectTextColors,
            projectCriticalPathColors: projectState.projectCriticalPathColors,
    };

    if (disableScroll) {
        return (
            <div className="flex flex-row items-start bg-card">
                {showTable && (
                    <div className="flex-shrink-0 border-r">
                        <TaskTable
                            {...commonTaskTableProps}
                            disableScroll={true}
                        />
                    </div>
                )}
                {showTimeline && (
                    <div className="flex-grow min-w-0">
                        <Timeline
                            {...commonTimelineProps}
                            disableScroll={true}
                        />
                    </div>
                )}
            </div>
        );
    }

    if (isMobile) {
        return (
            <div className="border rounded-lg overflow-hidden h-full relative bg-card flex flex-col">
                {projectName && (
                     <div className="px-4 py-2 font-semibold text-lg border-b bg-background z-10 flex-shrink-0">
                         {projectName}
                     </div>
                )}
                <div className="flex-1 overflow-auto relative flex flex-row items-start">
                    <div className={cn("z-30 bg-card h-full flex-shrink-0", isFixedLeftPanel && "sticky left-0 shadow-xl border-r")}>
                        <TaskTable
                            {...commonTaskTableProps}
                            disableScroll={true}
                            onToggleFixed={() => setIsFixedLeftPanel(!isFixedLeftPanel)}
                            isFixed={isFixedLeftPanel}
                        />
                    </div>
                    <div className="h-full min-w-0">
                        <Timeline
                            {...commonTimelineProps}
                            disableScroll={true}
                        />
                    </div>
                </div>
            </div>
        );
    }
    

    return (
        <div className="border rounded-lg overflow-hidden h-full flex flex-col bg-card">
            <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={50} minSize={20}>
                    <TaskTable {...commonTaskTableProps} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>
                    <Timeline {...commonTimelineProps} />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
