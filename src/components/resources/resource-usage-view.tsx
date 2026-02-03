'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { ProjectState, Resource, Task, Assignment, Calendar } from '@/lib/types';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { TimelineHeader } from '@/components/omni-gantt/timeline-header';
import { startOfDay, addDays, differenceInCalendarDays, eachDayOfInterval, min, max, format, isSameDay } from 'date-fns';
import { calendarService } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, User } from 'lucide-react';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 96; // 48px month + 48px day/week
const CELL_WIDTH_DAY = 40;
const CELL_WIDTH_WEEK = 100;
const CELL_WIDTH_MONTH = 50; // Dynamic based on days, but this is a fallback scaling factor

interface ResourceUsageRow {
    id: string;
    type: 'resource' | 'task';
    data: Resource | Task;
    resourceId: string;
    name: string;
    totalWork: number;
    dailyWork: Record<string, number>; // ISO date -> hours
    level: number;
    isExpanded?: boolean;
    assignments?: Assignment[];
}

const calculateResourceUsage = (
    tasks: Task[],
    resources: Resource[],
    assignments: Assignment[],
    calendar: Calendar | null,
    startDate: Date,
    endDate: Date
): ResourceUsageRow[] => {
    const rows: ResourceUsageRow[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    resources.forEach(resource => {
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);

        // Calculate Task Rows for this Resource
        const taskRows: ResourceUsageRow[] = [];
        let resourceTotalWork = 0;
        const resourceDailyWork: Record<string, number> = {};

        resourceAssignments.forEach(assignment => {
            const task = taskMap.get(assignment.taskId);
            if (!task) return;

            const units = assignment.units || 1;
            const taskDailyWork: Record<string, number> = {};
            let taskTotalWork = 0;

            // Simple distribution: 8 hours * units per working day
            // Only calculate within the view range for performance, or full task range?
            // Better to calculate full task range to get accurate totals, but maybe just view range for rendering?
            // Let's go with full task range but clipped to view for the daily map.

            const taskStart = startOfDay(task.start);
            const taskFinish = startOfDay(task.finish);

            // Iterate days from start to finish
            let current = taskStart;
            while (current <= taskFinish) {
                if (!calendar || calendarService.isWorkingDay(current, calendar)) {
                    const hours = 8 * units;
                    const dateKey = format(current, 'yyyy-MM-dd');

                    taskDailyWork[dateKey] = hours;
                    taskTotalWork += hours;

                    // Add to resource totals
                    resourceDailyWork[dateKey] = (resourceDailyWork[dateKey] || 0) + hours;
                    resourceTotalWork += hours;
                }
                current = addDays(current, 1);
            }

            taskRows.push({
                id: `res-${resource.id}-task-${task.id}`,
                type: 'task',
                data: task,
                resourceId: resource.id,
                name: task.name,
                totalWork: taskTotalWork,
                dailyWork: taskDailyWork,
                level: 1,
                assignments: [assignment]
            });
        });

        // Add Resource Row
        rows.push({
            id: resource.id,
            type: 'resource',
            data: resource,
            resourceId: resource.id,
            name: resource.name,
            totalWork: resourceTotalWork,
            dailyWork: resourceDailyWork,
            level: 0,
            isExpanded: true // Default expanded
        });

        rows.push(...taskRows);
    });

    return rows;
};

export function ResourceUsageView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { tasks, resources, assignments, calendars, defaultCalendarId, ganttSettings } = projectState;
    const defaultCalendar = useMemo(() => calendars.find(c => c.id === defaultCalendarId) || (calendars.length > 0 ? calendars[0] : null), [calendars, defaultCalendarId]);

    const [expandedResourceIds, setExpandedResourceIds] = useState<Set<string>>(new Set(resources.map(r => r.id)));
    const [viewRange, setViewRange] = useState<{start: Date, end: Date} | null>(null);

    const tableViewportRef = useRef<HTMLDivElement>(null);
    const timelineViewportRef = useRef<HTMLDivElement>(null);
    const isSyncingVerticalScroll = useRef(false);

    // Initial View Range Calculation
    useEffect(() => {
        if (tasks.length > 0) {
            const minDate = min(tasks.map(t => t.start));
            const maxDate = max(tasks.map(t => t.finish));
            setViewRange({
                start: addDays(startOfDay(minDate), -7),
                end: addDays(startOfDay(maxDate), 7)
            });
        } else {
             const today = startOfDay(new Date());
             setViewRange({
                 start: addDays(today, -7),
                 end: addDays(today, 21)
             });
        }
    }, [tasks.length]); // Only recalc if task count changes or on mount

    const scale = useMemo(() => {
        switch (ganttSettings.viewMode) {
            case 'month': return CELL_WIDTH_MONTH; // This logic needs to be consistent with TimelineHeader
            case 'week': return CELL_WIDTH_WEEK / 7; // Approx
            case 'day':
            default: return CELL_WIDTH_DAY;
        }
    }, [ganttSettings.viewMode]);

    // Recalculate usage data
    const usageData = useMemo(() => {
        if (!viewRange) return [];
        return calculateResourceUsage(tasks, resources, assignments, defaultCalendar, viewRange.start, viewRange.end);
    }, [tasks, resources, assignments, defaultCalendar, viewRange]);

    const visibleRows = useMemo(() => {
        return usageData.filter(row => {
            if (row.type === 'resource') return true;
            return expandedResourceIds.has(row.resourceId);
        });
    }, [usageData, expandedResourceIds]);

    const toggleExpand = (resourceId: string) => {
        const newSet = new Set(expandedResourceIds);
        if (newSet.has(resourceId)) {
            newSet.delete(resourceId);
        } else {
            newSet.add(resourceId);
        }
        setExpandedResourceIds(newSet);
    };

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

    if (!viewRange) return <div>Loading...</div>;

    const days = eachDayOfInterval({ start: viewRange.start, end: viewRange.end });
    const totalWidth = days.length * scale;

    return (
        <div className="border rounded-lg overflow-hidden h-full flex flex-col bg-card">
            <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Left Panel: Resource/Task Table */}
                <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="flex flex-col h-full border-r">
                        {/* Header */}
                        <div className="flex items-center border-b bg-muted/50 px-4 font-semibold text-sm" style={{ height: HEADER_HEIGHT }}>
                            <div className="flex-1">Resource Name</div>
                            <div className="w-24 text-right">Total Work</div>
                        </div>

                        {/* Rows */}
                        <ScrollAreaPrimitive.Root className="flex-1 w-full relative overflow-hidden bg-background">
                            <ScrollAreaPrimitive.Viewport
                                ref={tableViewportRef}
                                className="h-full w-full rounded-[inherit]"
                                onScroll={() => handleVerticalScroll('table')}
                            >
                                {visibleRows.map(row => (
                                    <div
                                        key={row.id}
                                        className={cn(
                                            "flex items-center px-4 border-b hover:bg-muted/50 transition-colors",
                                            row.type === 'resource' ? "bg-muted/20 font-medium" : "text-muted-foreground"
                                        )}
                                        style={{ height: ROW_HEIGHT, paddingLeft: `${row.level * 20 + 16}px` }}
                                    >
                                        <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                            {row.type === 'resource' && (
                                                <button onClick={() => toggleExpand(row.resourceId)} className="p-0.5 hover:bg-muted rounded">
                                                    {expandedResourceIds.has(row.resourceId) ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                                                </button>
                                            )}
                                            {row.type === 'resource' ? <User className="h-4 w-4 text-primary" /> : null}
                                            <span className="truncate">{row.name}</span>
                                        </div>
                                        <div className="w-24 text-right tabular-nums text-sm">
                                            {row.totalWork}h
                                        </div>
                                    </div>
                                ))}
                            </ScrollAreaPrimitive.Viewport>
                             <ScrollBar orientation="vertical" />
                             <ScrollBar orientation="horizontal" />
                        </ScrollAreaPrimitive.Root>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Panel: Time Grid */}
                <ResizablePanel defaultSize={70}>
                    <div className="flex flex-col h-full">
                        <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
                             <ScrollAreaPrimitive.Viewport
                                ref={timelineViewportRef}
                                className="h-full w-full rounded-[inherit]"
                                onScroll={() => handleVerticalScroll('timeline')}
                            >
                                <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
                                    <TimelineHeader startDate={viewRange.start} endDate={viewRange.end} scale={scale} />

                                    <div className="relative">
                                        {/* Grid Rows */}
                                        {visibleRows.map((row, index) => {
                                             return (
                                                <div
                                                    key={row.id}
                                                    className="flex border-b"
                                                    style={{ height: ROW_HEIGHT }}
                                                >
                                                    {days.map((day, i) => {
                                                        const dateKey = format(day, 'yyyy-MM-dd');
                                                        const work = row.dailyWork[dateKey];
                                                        const isWeekend = !defaultCalendar || !calendarService.isWorkingDay(day, defaultCalendar);

                                                        // Check specific day overallocation for resource
                                                        const isDayOverallocated = row.type === 'resource' && work > (8 * ((row.data as Resource).availability || 1));

                                                        return (
                                                            <div
                                                                key={dateKey}
                                                                className={cn(
                                                                    "flex-shrink-0 flex items-center justify-center text-xs border-r tabular-nums",
                                                                    isWeekend ? "bg-muted/30" : "",
                                                                    isDayOverallocated ? "text-destructive font-bold" : ""
                                                                )}
                                                                style={{ width: scale }}
                                                            >
                                                                {work ? `${work}h` : ''}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </ScrollAreaPrimitive.Viewport>
                            <ScrollBar orientation="vertical" />
                            <ScrollBar orientation="horizontal" />
                        </ScrollAreaPrimitive.Root>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
