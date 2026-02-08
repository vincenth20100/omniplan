
'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Task, Link, UiDensity, Calendar, GanttSettings, Baseline, RenderableRow, TaskRow, ColumnSpec, Resource, Assignment } from '@/lib/types';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { TimelineHeader } from './timeline-header';
import { TaskBar } from './task-bar';
import { DependencyLines } from './dependency-lines';
import { addDays, differenceInDays, min, max, startOfDay, differenceInCalendarDays, eachDayOfInterval, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { DENSITY_SETTINGS } from '@/lib/settings';
import { calendarService } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { useVirtualization } from '@/hooks/use-virtualization';

const VIEW_PADDING_DAYS = 30;

const SplitSummaryTaskBar = React.memo(({ task, ganttSettings, allTasks, uiDensity, selectedTaskIds, dispatch, index, viewStartDate, scale }: {
    task: Task,
    ganttSettings: GanttSettings,
    allTasks: Task[],
    uiDensity: UiDensity,
    selectedTaskIds: string[],
    dispatch: any,
    index: number,
    viewStartDate: Date,
    scale: number
}) => {
    
    const children = allTasks.filter(t => t.parentId === task.id);
    children.sort((a, b) => a.start.getTime() - b.start.getTime());

    const segments: {start: Date, finish: Date}[] = [];
    if (children.length > 0) {
        let currentSegment = { start: new Date(children[0].start), finish: new Date(children[0].finish) };
        for (let i = 1; i < children.length; i++) {
            const child = children[i];
            if (child.start <= addDays(currentSegment.finish, 1)) {
                currentSegment.finish = new Date(Math.max(currentSegment.finish.getTime(), child.finish.getTime()));
            } else {
                segments.push(currentSegment);
                currentSegment = { start: new Date(child.start), finish: new Date(child.finish) };
            }
        }
        segments.push(currentSegment);
    }

    const { summaryBarHeight, rowHeight } = DENSITY_SETTINGS[uiDensity];
    const offsetDays = differenceInCalendarDays(task.start, viewStartDate);
    const left = offsetDays * scale;
    const width = (differenceInCalendarDays(task.finish, task.start) + 1) * scale;
    const top = index * rowHeight + (rowHeight - summaryBarHeight) / 2;
    const dateFormat = ganttSettings.dateFormat || 'MMM d, yyyy';

    // Fallback if no segments found (safe rendering)
    if (segments.length === 0) {
        return (
            <div
                className={cn(
                    "absolute flex items-center group transition-all duration-200",
                    selectedTaskIds.includes(task.id) ? "ring-2 ring-offset-2 ring-accent ring-offset-card" : "hover:ring-1 hover:ring-accent",
                    task.isCritical && ganttSettings.highlightCriticalPath ? "bg-destructive/15 border-2 border-destructive/90 rounded-sm" : "bg-muted border-2 border-primary/90 rounded-sm"
                )}
                style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: `${summaryBarHeight}px`
                }}
                onClick={(e) => dispatch({ type: 'UPDATE_SELECTION', payload: { mode: 'row', taskId: task.id, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey } })}
            >
                <div className={cn(
                    "absolute -left-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent",
                    task.isCritical && ganttSettings.highlightCriticalPath ? "border-t-[7px] border-t-destructive/90" : "border-t-[7px] border-t-primary/90"
                )}></div>
                <div className={cn(
                    "absolute -right-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent",
                    task.isCritical && ganttSettings.highlightCriticalPath ? "border-t-[7px] border-t-destructive/90" : "border-t-[7px] border-t-primary/90"
                )}></div>
            </div>
        )
    }
    
    return (
         <div 
            key={task.id}
            className="absolute"
            style={{
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${summaryBarHeight}px`
            }}
            onClick={(e) => dispatch({ type: 'UPDATE_SELECTION', payload: { mode: 'row', taskId: task.id, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey } })}
        >
            {segments.map((segment, segIndex) => {
                const segmentOffsetDays = differenceInCalendarDays(segment.start, task.start);
                const segmentLeft = segmentOffsetDays * scale;
                const segmentWidth = (differenceInCalendarDays(segment.finish, segment.start) + 1) * scale;
                
                return (
                    <div
                        key={segIndex}
                        title={`${format(segment.start, dateFormat)} - ${format(segment.finish, dateFormat)}`}
                        className={cn(
                            "absolute flex items-center group",
                            task.isCritical && ganttSettings.highlightCriticalPath ? "bg-destructive/15 border-2 border-destructive/90 rounded-sm" : "bg-muted border-2 border-primary/90 rounded-sm",
                             selectedTaskIds.includes(task.id) ? "ring-2 ring-offset-2 ring-accent ring-offset-card" : "hover:ring-1 hover:ring-accent",
                        )}
                        style={{
                            top: 0,
                            left: `${segmentLeft}px`,
                            width: `${segmentWidth}px`,
                            height: '100%'
                        }}
                    >
                        {segIndex === 0 && (
                            <div className={cn(
                                "absolute -left-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent",
                                task.isCritical && ganttSettings.highlightCriticalPath ? "border-t-[7px] border-t-destructive/90" : "border-t-[7px] border-t-primary/90"
                            )}></div>
                        )}
                        {segIndex === segments.length - 1 && (
                            <div className={cn(
                                "absolute -right-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent",
                                task.isCritical && ganttSettings.highlightCriticalPath ? "border-t-[7px] border-t-destructive/90" : "border-t-[7px] border-t-primary/90"
                            )}></div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});
SplitSummaryTaskBar.displayName = 'SplitSummaryTaskBar';


export function Timeline({ 
    allTasks,
    renderableRows, 
    links, 
    dispatch, 
    selectedTaskIds,
    viewportRef,
    onScroll,
    uiDensity,
    defaultCalendar,
    ganttSettings,
    baselines,
    projectColors,
    projectTextColors,
    projectCriticalPathColors,
    disableScroll,
    columns,
    resources,
    assignments,
}: { 
    allTasks: Task[],
    renderableRows: RenderableRow[], 
    links: Link[], 
    dispatch: any, 
    selectedTaskIds: string[],
    viewportRef: React.RefObject<HTMLDivElement | null>,
    onScroll: () => void,
    uiDensity: UiDensity,
    defaultCalendar: Calendar | null,
    ganttSettings: GanttSettings,
    baselines: Baseline[],
    projectColors?: Record<string, string>,
    projectTextColors?: Record<string, string>,
    projectCriticalPathColors?: Record<string, string>,
    disableScroll?: boolean,
    columns?: ColumnSpec[],
    resources?: Resource[],
    assignments?: Assignment[],
}) {
  const [defaultDateRange, setDefaultDateRange] = useState<{viewStartDate: Date, viewEndDate: Date} | null>(null);

  const comparisonBaseline = useMemo(() => {
    if (!ganttSettings.comparisonBaselineId) return null;
    return baselines.find(b => b.id === ganttSettings.comparisonBaselineId);
  }, [baselines, ganttSettings.comparisonBaselineId]);

  const baselineTaskMap = useMemo(() => {
      if (!comparisonBaseline) return null;
      const map = new Map<string, Task>();
      comparisonBaseline.tasks.forEach(task => {
          map.set(task.id, task);
      });
      return map;
  }, [comparisonBaseline]);

  const { rowHeight, barHeight } = DENSITY_SETTINGS[uiDensity];

  const scale = useMemo(() => {
    const zoom = ganttSettings.zoom || 1;
    switch (ganttSettings.viewMode) {
      case 'year': return 0.5 * zoom;
      case 'semester': return 1 * zoom;
      case 'quarter': return 2 * zoom;
      case 'month': return 5 * zoom;
      case 'week': return 15 * zoom;
      case 'day':
      default:
        return 40 * zoom;
    }
  }, [ganttSettings.viewMode, ganttSettings.zoom]);

  const getScrollElement = useCallback(() => viewportRef.current, [viewportRef]);
  const estimateSize = useCallback(() => rowHeight, [rowHeight]);

  const { virtualItems: verticalVirtualItems } = useVirtualization({
    count: renderableRows.length,
    getScrollElement,
    estimateSize,
    overscan: 20,
    axis: 'y'
  });

  const estimateColumnSize = useCallback(() => scale, [scale]);

  const rowsToRender = disableScroll ?
    renderableRows.map((_, index) => ({ index })) :
    verticalVirtualItems;


  React.useEffect(() => {
      // This will only run on the client, preventing hydration mismatch
      const today = startOfDay(new Date());
      setDefaultDateRange({
          viewStartDate: addDays(today, -VIEW_PADDING_DAYS),
          viewEndDate: addDays(today, VIEW_PADDING_DAYS),
      });
  }, []);

  const visibleTasks = useMemo(() => 
      renderableRows.filter((r): r is TaskRow => r.itemType === 'task').map(r => r.data)
  , [renderableRows]);

  const { viewStartDate, viewEndDate } = useMemo(() => {
    if (visibleTasks.length > 0) {
        const minDate = min(visibleTasks.map(t => t.start));
        const maxDate = max(visibleTasks.map(t => t.finish));
        return {
          viewStartDate: addDays(minDate, -15),
          viewEndDate: addDays(maxDate, 15),
        };
    }
    if (defaultDateRange) {
        return defaultDateRange;
    }
    // Return a static date for SSR to prevent mismatch, will be updated on client.
    const staticDate = startOfDay(new Date('2024-01-01T00:00:00.000Z'));
    return {
      viewStartDate: addDays(staticDate, -VIEW_PADDING_DAYS),
      viewEndDate: addDays(staticDate, VIEW_PADDING_DAYS),
    };
  }, [visibleTasks, defaultDateRange]);
  
  // Calculate total days for virtualization
  const totalDays = useMemo(() => differenceInCalendarDays(viewEndDate, viewStartDate) + 1, [viewStartDate, viewEndDate]);

  const { virtualItems: horizontalVirtualItems } = useVirtualization({
    count: totalDays,
    getScrollElement,
    estimateSize: estimateColumnSize,
    overscan: 10,
    axis: 'x'
  });

  // Calculate visible horizontal range
  const visibleStartX = horizontalVirtualItems.length > 0 ? horizontalVirtualItems[0].start : 0;
  const lastHorizontalItem = horizontalVirtualItems[horizontalVirtualItems.length - 1];
  const visibleEndX = lastHorizontalItem ? lastHorizontalItem.start + lastHorizontalItem.size : 0;

  const dateFormat = ganttSettings.dateFormat || 'MMM d, yyyy';

  const totalWidth = useMemo(() => {
    return (differenceInCalendarDays(viewEndDate, viewStartDate) + 1) * scale;
  }, [viewStartDate, viewEndDate, scale]);
  
  const taskIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    renderableRows.forEach((row, index) => {
        if (row.itemType === 'task') {
            map.set(row.data.id, index);
        }
    });
    return map;
  }, [renderableRows]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayOffset = useMemo(() => differenceInCalendarDays(today, viewStartDate) * scale, [today, viewStartDate, scale]);
  
  if (visibleTasks.length === 0 && !defaultDateRange) {
    return <div className="flex h-full w-full items-center justify-center"><p>Loading timeline...</p></div>
  }
  
  const totalHeight = renderableRows.length * rowHeight;

  // Calculate visible vertical range for dependency filtering
  const visibleRowStart = rowsToRender.length > 0 ? rowsToRender[0].index : 0;
  const visibleRowEnd = rowsToRender.length > 0 ? rowsToRender[rowsToRender.length - 1].index : 0;

  const content = (
          <div style={{ width: totalWidth, minHeight: '100%' }} className="relative pb-40">
            <TimelineHeader
                startDate={viewStartDate}
                endDate={viewEndDate}
                scale={scale}
                viewMode={ganttSettings.viewMode}
                visibleStartX={visibleStartX}
                visibleEndX={visibleEndX}
            />
            <div className="relative h-full" style={{height: `${totalHeight}px`}}>
              {defaultCalendar && ganttSettings.highlightNonWorkingTime && horizontalVirtualItems.map((virtualColumn) => {
                    const day = addDays(viewStartDate, virtualColumn.index);
                    if (!calendarService.isWorkingDay(day, defaultCalendar)) {
                        return (
                            <div
                                key={virtualColumn.index}
                                className="absolute top-0 h-full bg-muted/20"
                                style={{
                                    left: `${virtualColumn.start}px`,
                                    width: `${virtualColumn.size}px`,
                                }}
                            />
                        );
                    }
                    return null;
                })}
              
              {ganttSettings.showTodayLine && todayOffset >= 0 && todayOffset <= totalWidth && (
                <div
                    className="absolute top-0 h-full w-0.5 bg-accent z-10"
                    style={{ left: `${todayOffset}px` }}
                    title={`Today: ${format(today, dateFormat)}`}
                >
                  <div className="absolute -top-1.5 -ml-1.5 h-3 w-3 rounded-full bg-accent" />
                </div>
              )}

              {rowsToRender.map((virtualRow) => {
                const index = virtualRow.index;
                const row = renderableRows[index];
                if (!row) return null;

                if (row.itemType === 'task') {
                    const task = row.data;
                    const isSplit = task.isSummary && ganttSettings.renderSplitTasks;

                    const baselineTask = baselineTaskMap ? baselineTaskMap.get(task.id) : undefined;
                    
                    return (
                        <React.Fragment key={task.id}>
                          {isSplit ? (
                            <SplitSummaryTaskBar
                                task={task}
                                ganttSettings={ganttSettings}
                                allTasks={allTasks}
                                uiDensity={uiDensity}
                                selectedTaskIds={selectedTaskIds}
                                dispatch={dispatch}
                                index={index}
                                viewStartDate={viewStartDate}
                                scale={scale}
                            />
                          ) : (
                            <TaskBar
                              task={task}
                              ganttStartDate={viewStartDate}
                              scale={scale}
                              dispatch={dispatch}
                              row={index}
                              isSelected={selectedTaskIds.includes(task.id)}
                              onSelect={(e) => dispatch({ type: 'UPDATE_SELECTION', payload: { mode: 'row', taskId: task.id, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey } })}
                              uiDensity={uiDensity}
                              showProgress={ganttSettings.showProgress}
                              showTaskLabels={ganttSettings.showTaskLabels}
                              taskLabels={ganttSettings.taskLabels}
                              highlightCriticalPath={ganttSettings.highlightCriticalPath}
                              defaultCalendar={defaultCalendar}
                              dateFormat={dateFormat}
                              projectColors={projectColors}
                              projectTextColors={projectTextColors}
                              projectCriticalPathColors={projectCriticalPathColors}
                              tooltipFields={ganttSettings.showGanttTooltip !== false ? ganttSettings.tooltipFields : []}
                              tooltipConfig={ganttSettings.showGanttTooltip !== false ? ganttSettings.tooltipConfig : []}
                              columns={columns}
                              resources={resources}
                              assignments={assignments}
                              links={links}
                              tasks={allTasks}
                            />
                          )}
                          {baselineTask && !task.isSummary && (
                              <div
                                  className="absolute rounded-sm bg-muted-foreground/60 pointer-events-none"
                                  style={{
                                      top: `${index * rowHeight + (rowHeight - barHeight) / 2 + barHeight - 4}px`,
                                      left: `${differenceInCalendarDays(baselineTask.start, viewStartDate) * scale}px`,
                                      width: `${(differenceInCalendarDays(baselineTask.finish, baselineTask.start) + 1) * scale}px`,
                                      height: '4px',
                                  }}
                                  title={`Baseline: ${baselineTask.name}\n${format(baselineTask.start, dateFormat)} - ${format(baselineTask.finish, dateFormat)}`}
                              />
                          )}
                        </React.Fragment>
                    );
                }
                return null;
              })}
              {ganttSettings.showDependencies && <DependencyLines 
                links={links} 
                tasks={allTasks}
                taskIndexMap={taskIndexMap}
                rowHeight={rowHeight}
                scale={scale}
                ganttStartDate={viewStartDate}
                visibleRowStart={visibleRowStart}
                visibleRowEnd={visibleRowEnd}
              />}
            </div>
          </div>
  );

  return (
    <div className="h-full w-full relative">
      {disableScroll ? (
        content
      ) : (
      <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
        <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]" onScroll={onScroll}>
          {content}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
      )}
    </div>
  );
}
