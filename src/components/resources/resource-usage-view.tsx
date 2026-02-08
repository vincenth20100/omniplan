'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { ProjectState, Resource, Task, Assignment, Calendar, ResourceUsageRow } from '@/lib/types';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { TimelineHeader } from '@/components/omni-gantt/timeline-header';
import {
    startOfDay,
    addDays,
    differenceInCalendarDays,
    eachDayOfInterval,
    min,
    max,
    format,
    isSameDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachWeekOfInterval,
    eachMonthOfInterval,
    differenceInDays,
    isWeekend as isWeekendFn
} from 'date-fns';
import { calendarService } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, User, BarChart2, Hash, AreaChart } from 'lucide-react';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { ResourceTable } from './resource-table';
import { ResourceLoadChart } from './resource-load-chart';
import { calculateResourceUsage } from '@/lib/resource-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 96;
const CELL_WIDTH_DAY = 40;
const CELL_WIDTH_WEEK = 100;

export function ResourceUsageView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { tasks, resources, assignments, calendars, defaultCalendarId, ganttSettings } = projectState;
    const defaultCalendar = useMemo(() => calendars.find(c => c.id === defaultCalendarId) || (calendars.length > 0 ? calendars[0] : null), [calendars, defaultCalendarId]);

    const [expandedResourceIds, setExpandedResourceIds] = useState<Set<string>>(new Set(resources.map(r => r.id)));
    const [viewRange, setViewRange] = useState<{start: Date, end: Date} | null>(null);

    // View Controls
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>((['day', 'week', 'month'].includes(ganttSettings.viewMode || '') ? ganttSettings.viewMode as any : 'day'));
    const [displayMode, setDisplayMode] = useState<'hours' | 'bar'>('hours');
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});

    // New State for Chart
    const [showLoadChart, setShowLoadChart] = useState(false);

    const tableViewportRef = useRef<HTMLDivElement>(null);
    const timelineViewportRef = useRef<HTMLDivElement>(null);
    const chartViewportRef = useRef<HTMLDivElement>(null);

    const isSyncingVerticalScroll = useRef(false);
    const isSyncingHorizontalScroll = useRef(false);

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
    }, [tasks.length]);

    const scale = useMemo(() => {
        switch (viewMode) {
            case 'month': return 2; // Very compressed for month view
            case 'week': return 15; // Compressed for week view
            case 'day':
            default: return CELL_WIDTH_DAY;
        }
    }, [viewMode]);

    // Recalculate usage data
    const usageData = useMemo(() => {
        if (!viewRange) return [];
        return calculateResourceUsage(tasks, resources, assignments, defaultCalendar, viewRange.start, viewRange.end);
    }, [tasks, resources, assignments, defaultCalendar, viewRange]);

    const visibleRows = useMemo(() => {
        // 1. Group by resource
        const groups: { resource: ResourceUsageRow, tasks: ResourceUsageRow[] }[] = [];
        let currentGroup: { resource: ResourceUsageRow, tasks: ResourceUsageRow[] } | null = null;

        usageData.forEach(row => {
            if (row.type === 'resource') {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = { resource: row, tasks: [] };
            } else if (currentGroup && row.type === 'task') {
                currentGroup.tasks.push(row);
            }
        });
        if (currentGroup) groups.push(currentGroup);

        // 2. Filter
        let filteredGroups = groups.filter(group => {
            // Check Name filter
            if (filters.name && !group.resource.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
            // Check Type filter
            if (filters.type && (group.resource.data as Resource).type.toLowerCase() !== filters.type.toLowerCase()) return false;

            return true;
        });

        // 3. Sort
        if (sortColumn && sortDirection) {
            filteredGroups.sort((a, b) => {
                let valA: any = '';
                let valB: any = '';

                if (sortColumn === 'name') {
                    valA = a.resource.name;
                    valB = b.resource.name;
                } else if (sortColumn === 'type') {
                    valA = (a.resource.data as Resource).type;
                    valB = (b.resource.data as Resource).type;
                } else if (sortColumn === 'maxUnits') {
                    valA = (a.resource.data as Resource).availability || 1;
                    valB = (b.resource.data as Resource).availability || 1;
                } else if (sortColumn === 'totalWork') {
                    valA = a.resource.totalWork;
                    valB = b.resource.totalWork;
                }

                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // 4. Flatten
        const flatRows: ResourceUsageRow[] = [];
        filteredGroups.forEach(group => {
            flatRows.push(group.resource);
            if (expandedResourceIds.has(group.resource.resourceId)) {
                flatRows.push(...group.tasks);
            }
        });

        return flatRows;
    }, [usageData, expandedResourceIds, sortColumn, sortDirection, filters]);

    const handleSort = (columnId: string) => {
        if (sortColumn === columnId) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
            if (sortDirection === 'desc') setSortColumn(null);
        } else {
            setSortColumn(columnId);
            setSortDirection('asc');
        }
    };

    const handleFilterChange = (columnId: string, value: string) => {
        setFilters(prev => ({ ...prev, [columnId]: value }));
    };

    const toggleExpand = (resourceId: string) => {
        const newSet = new Set(expandedResourceIds);
        if (newSet.has(resourceId)) {
            newSet.delete(resourceId);
        } else {
            newSet.add(resourceId);
        }
        setExpandedResourceIds(newSet);
    };

    const handleScroll = useCallback((scroller: 'table' | 'timeline' | 'chart', axis: 'vertical' | 'horizontal') => {
        if (axis === 'vertical') {
             if (isSyncingVerticalScroll.current) {
                isSyncingVerticalScroll.current = false;
                return;
            }
            isSyncingVerticalScroll.current = true;
            // Sync Table <-> Timeline
            if (scroller === 'table' && timelineViewportRef.current && tableViewportRef.current) {
                timelineViewportRef.current.scrollTop = tableViewportRef.current.scrollTop;
            } else if (scroller === 'timeline' && tableViewportRef.current && timelineViewportRef.current) {
                tableViewportRef.current.scrollTop = timelineViewportRef.current.scrollTop;
            }
        } else if (axis === 'horizontal') {
             if (isSyncingHorizontalScroll.current) {
                isSyncingHorizontalScroll.current = false;
                return;
            }
            isSyncingHorizontalScroll.current = true;
            // Sync Timeline <-> Chart
             if (scroller === 'timeline' && chartViewportRef.current && timelineViewportRef.current) {
                chartViewportRef.current.scrollLeft = timelineViewportRef.current.scrollLeft;
            } else if (scroller === 'chart' && timelineViewportRef.current && chartViewportRef.current) {
                 timelineViewportRef.current.scrollLeft = chartViewportRef.current.scrollLeft;
            }
        }
    }, []);

    const timePeriods = useMemo(() => {
        if (!viewRange) return [];
        if (viewMode === 'day') {
            return eachDayOfInterval({ start: viewRange.start, end: viewRange.end }).map(d => ({ start: d, end: d, key: format(d, 'yyyy-MM-dd') }));
        } else if (viewMode === 'week') {
            const start = startOfWeek(viewRange.start, { weekStartsOn: 1 });
            return eachWeekOfInterval({ start, end: viewRange.end }, { weekStartsOn: 1 }).map(d => ({
                start: d,
                end: addDays(d, 6),
                key: format(d, 'yyyy-w')
            }));
        } else {
            const start = startOfMonth(viewRange.start);
            return eachMonthOfInterval({ start, end: viewRange.end }).map(d => ({
                start: d,
                end: endOfMonth(d),
                key: format(d, 'yyyy-MM')
            }));
        }
    }, [viewRange, viewMode]);

    // Calculate chart data
    const chartData = useMemo(() => {
        if (!showLoadChart || !viewRange) return [];

        // Map visible rows to a quick lookup if needed, but we iterate timePeriods primarily
        // Only consider Resource type rows for the aggregated chart
        const resourceRows = visibleRows.filter(r => r.type === 'resource');

        return timePeriods.map(period => {
            const dataPoint: any = { name: period.key };

            resourceRows.forEach(row => {
                 let periodWork = 0;
                 let d = period.start;
                 while (d <= period.end) {
                    const k = format(d, 'yyyy-MM-dd');
                    periodWork += row.dailyWork[k] || 0;
                    d = addDays(d, 1);
                 }
                 if (periodWork > 0) {
                     dataPoint[row.resourceId] = periodWork;
                 }
            });
            return dataPoint;
        });
    }, [showLoadChart, viewRange, timePeriods, visibleRows]);

    if (!viewRange) return <div>Loading...</div>;

    // Calculate total width based on periods and scale
    let totalWidth = 0;
    timePeriods.forEach(p => {
        const days = differenceInDays(p.end, p.start) + 1;
        totalWidth += days * scale;
    });

    const GridContent = (
         <div className="flex flex-col h-full">
            <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
                    <ScrollAreaPrimitive.Viewport
                    ref={timelineViewportRef}
                    className="h-full w-full rounded-[inherit]"
                    onScroll={(e) => {
                        handleScroll('timeline', 'vertical');
                        if (showLoadChart) handleScroll('timeline', 'horizontal');
                    }}
                >
                    <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
                        <TimelineHeader startDate={viewRange.start} endDate={viewRange.end} scale={scale} viewMode={viewMode} />

                        <div className="relative">
                            {/* Grid Rows */}
                            {visibleRows.map((row, index) => {
                                    return (
                                    <div
                                        key={row.id}
                                        className="flex border-b"
                                        style={{ height: ROW_HEIGHT }}
                                    >
                                        {timePeriods.map((period) => {
                                            const periodDays = differenceInDays(period.end, period.start) + 1;
                                            const width = periodDays * scale;

                                            // Aggregate work
                                            let periodWork = 0;
                                            let workingDays = 0;

                                            let d = period.start;
                                            while (d <= period.end) {
                                                const k = format(d, 'yyyy-MM-dd');
                                                periodWork += row.dailyWork[k] || 0;
                                                if (!defaultCalendar || calendarService.isWorkingDay(d, defaultCalendar)) {
                                                    workingDays++;
                                                }
                                                d = addDays(d, 1);
                                            }

                                            const capacity = (row.data as Resource).availability ? (row.data as Resource).availability! * 8 * workingDays : 8 * workingDays;
                                            const isOverallocated = row.type === 'resource' && periodWork > capacity;
                                            const loadPercent = capacity > 0 ? (periodWork / capacity) * 100 : 0;

                                            return (
                                                <div
                                                    key={period.key}
                                                    className={cn(
                                                        "flex-shrink-0 flex items-center justify-center text-xs border-r tabular-nums relative",
                                                        isOverallocated ? "font-bold" : ""
                                                    )}
                                                    style={{ width }}
                                                >
                                                    {displayMode === 'bar' && periodWork > 0 ? (
                                                            <div className="w-full h-full px-1 py-2 flex items-end justify-center bg-transparent z-0">
                                                            <div
                                                                className={cn(
                                                                    "w-full rounded-sm transition-all",
                                                                    isOverallocated ? "bg-destructive" : "bg-primary"
                                                                )}
                                                                style={{ height: `${Math.min(loadPercent, 100)}%` }}
                                                                title={`${Math.round(loadPercent)}% Load`}
                                                            />
                                                            </div>
                                                    ) : (
                                                        <span className={cn(isOverallocated && "text-destructive")}>
                                                            {periodWork > 0 ? `${Math.round(periodWork * 10) / 10}h` : ''}
                                                        </span>
                                                    )}
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
    );

    return (
        <div className="border rounded-lg overflow-hidden h-full flex flex-col bg-card">
            {/* Toolbar */}
            <div className="flex items-center gap-4 p-2 border-b bg-card">
                 <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                   <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="View Mode" />
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="day">Days</SelectItem>
                      <SelectItem value="week">Weeks</SelectItem>
                      <SelectItem value="month">Months</SelectItem>
                   </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-6" />

                <ToggleGroup type="single" value={displayMode} onValueChange={(v) => v && setDisplayMode(v as any)}>
                    <ToggleGroupItem value="hours" size="sm" className="text-xs px-2 h-8" title="Show Hours">
                        <Hash className="h-4 w-4 mr-1"/> Hours
                    </ToggleGroupItem>
                    <ToggleGroupItem value="bar" size="sm" className="text-xs px-2 h-8" title="Show Load Bar">
                        <BarChart2 className="h-4 w-4 mr-1"/> Load
                    </ToggleGroupItem>
                </ToggleGroup>

                <Separator orientation="vertical" className="h-6" />

                <Toggle
                    pressed={showLoadChart}
                    onPressedChange={setShowLoadChart}
                    size="sm"
                    aria-label="Toggle load chart"
                    className="gap-2"
                >
                    <AreaChart className="h-4 w-4" />
                    <span className="text-xs">Load Chart</span>
                </Toggle>
            </div>

            <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Left Panel: Resource Table */}
                <ResizablePanel defaultSize={30} minSize={20}>
                    <ResourceTable
                        rows={visibleRows}
                        expandedResourceIds={expandedResourceIds}
                        onToggleExpand={toggleExpand}
                        viewportRef={tableViewportRef as any}
                        onScroll={() => handleScroll('table', 'vertical')}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Panel: Time Grid & Chart */}
                <ResizablePanel defaultSize={70}>
                    {showLoadChart ? (
                        <ResizablePanelGroup direction="vertical">
                            <ResizablePanel defaultSize={70}>
                                {GridContent}
                            </ResizablePanel>
                            <ResizableHandle withHandle />
                            <ResizablePanel defaultSize={30}>
                                <div className="h-full w-full relative">
                                    <div
                                        ref={chartViewportRef as any}
                                        className="h-full w-full overflow-x-auto overflow-y-hidden"
                                        onScroll={() => handleScroll('chart', 'horizontal')}
                                    >
                                        <ResourceLoadChart
                                            data={chartData}
                                            resources={resources}
                                            width={totalWidth}
                                            height={200} // This is relative, component uses 100% of container height
                                        />
                                    </div>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    ) : (
                        GridContent
                    )}
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
