'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Task, Link, UiDensity, Calendar, GanttSettings } from '@/lib/types';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { TimelineHeader } from './timeline-header';
import { TaskBar } from './task-bar';
import { DependencyLines } from './dependency-lines';
import { addDays, differenceInDays, min, max, startOfDay, differenceInCalendarDays, eachDayOfInterval, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { DENSITY_SETTINGS } from '@/lib/settings';
import { type RenderableRow, type TaskRow } from './gantt-chart';
import { calendarService } from '@/lib/calendar';

const VIEW_PADDING_DAYS = 30;

export function Timeline({ 
    renderableRows, 
    links, 
    dispatch, 
    selectedTaskIds,
    viewportRef,
    onScroll,
    uiDensity,
    defaultCalendar,
    ganttSettings
}: { 
    renderableRows: RenderableRow[], 
    links: Link[], 
    dispatch: any, 
    selectedTaskIds: string[],
    viewportRef: React.RefObject<HTMLDivElement>,
    onScroll: () => void,
    uiDensity: UiDensity,
    defaultCalendar: Calendar | null,
    ganttSettings: GanttSettings
}) {
  const [taskBarElements, setTaskBarElements] = useState<Record<string, HTMLDivElement | null>>({});
  const [defaultDateRange, setDefaultDateRange] = useState<{viewStartDate: Date, viewEndDate: Date} | null>(null);

  const { rowHeight } = DENSITY_SETTINGS[uiDensity];

  const scale = useMemo(() => {
    switch (ganttSettings.viewMode) {
      case 'month': return 5;
      case 'week': return 15;
      case 'day':
      default:
        return 40;
    }
  }, [ganttSettings.viewMode]);


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
  
  const days = useMemo(() => eachDayOfInterval({ start: viewStartDate, end: viewEndDate }), [viewStartDate, viewEndDate]);

  const totalWidth = useMemo(() => {
    return (differenceInCalendarDays(viewEndDate, viewStartDate) + 1) * scale;
  }, [viewStartDate, viewEndDate, scale]);

  const registerBarElement = useCallback((taskId: string, element: HTMLDivElement | null) => {
    setTaskBarElements(prev => ({ ...prev, [taskId]: element }));
  }, []);
  
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

  return (
    <div className="h-full w-full relative">
      <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
        <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]" onScroll={onScroll}>
          <div style={{ width: totalWidth, minHeight: '100%' }} className="relative pb-40">
            <TimelineHeader startDate={viewStartDate} endDate={viewEndDate} scale={scale} />
            <div className="relative h-full" style={{height: `${totalHeight}px`}}>
              {defaultCalendar && ganttSettings.highlightNonWorkingTime && days.map((day, index) => {
                    if (!calendarService.isWorkingDay(day, defaultCalendar)) {
                        return (
                            <div
                                key={index}
                                className="absolute top-0 h-full bg-muted/20"
                                style={{
                                    left: `${index * scale}px`,
                                    width: `${scale}px`,
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
                    title={`Today: ${format(today, 'MMM d, yyyy')}`}
                >
                  <div className="absolute -top-1.5 -ml-1.5 h-3 w-3 rounded-full bg-accent" />
                </div>
              )}

              {renderableRows.map((row, index) => {
                if (row.itemType === 'task') {
                    const task = row.data;
                    return (
                        <TaskBar
                        key={task.id}
                        task={task}
                        ganttStartDate={viewStartDate}
                        scale={scale}
                        dispatch={dispatch}
                        row={index}
                        isSelected={selectedTaskIds.includes(task.id)}
                        onSelect={(e) => dispatch({ type: 'SELECT_TASK', payload: { taskId: task.id, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey } })}
                        registerBarElement={registerBarElement}
                        uiDensity={uiDensity}
                        showProgress={ganttSettings.showProgress}
                        showTaskLabels={ganttSettings.showTaskLabels}
                        highlightCriticalPath={ganttSettings.highlightCriticalPath}
                        />
                    );
                }
                return null;
              })}
              {ganttSettings.showDependencies && <DependencyLines 
                links={links} 
                taskBarElements={taskBarElements}
                taskIndexMap={taskIndexMap}
                rowHeight={rowHeight}
                scale={scale}
              />}
            </div>
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    </div>
  );
}
