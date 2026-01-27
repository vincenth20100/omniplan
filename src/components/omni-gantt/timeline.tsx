'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Task, Link, UiDensity } from '@/lib/types';
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";
import { TimelineHeader } from './timeline-header';
import { TaskBar } from './task-bar';
import { DependencyLines } from './dependency-lines';
import { addDays, differenceInDays, min, max, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { DENSITY_SETTINGS } from '@/lib/settings';
import { type RenderableRow, type TaskRow } from './gantt-chart';

const VIEW_PADDING_DAYS = 30;

export function Timeline({ 
    renderableRows, 
    links, 
    dispatch, 
    selectedTaskIds,
    viewportRef,
    onScroll,
    uiDensity
}: { 
    renderableRows: RenderableRow[], 
    links: Link[], 
    dispatch: any, 
    selectedTaskIds: string[],
    viewportRef: React.RefObject<HTMLDivElement>,
    onScroll: () => void,
    uiDensity: UiDensity
}) {
  const [taskBarElements, setTaskBarElements] = useState<Record<string, HTMLDivElement | null>>({});
  const [defaultDateRange, setDefaultDateRange] = useState<{viewStartDate: Date, viewEndDate: Date} | null>(null);
  const [scale, setScale] = useState(35); // pixels per day

  const { rowHeight } = DENSITY_SETTINGS[uiDensity];

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

  const totalWidth = useMemo(() => {
    return (differenceInDays(viewEndDate, viewStartDate) + 1) * scale;
  }, [viewStartDate, viewEndDate, scale]);

  const registerBarElement = useCallback((taskId: string, element: HTMLDivElement | null) => {
    setTaskBarElements(prev => ({ ...prev, [taskId]: element }));
  }, []);
  
  const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 150));
  const handleZoomOut = () => setScale(s => Math.max(s / 1.2, 10));

  const taskIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    renderableRows.forEach((row, index) => {
        if (row.itemType === 'task') {
            map.set(row.data.id, index);
        }
    });
    return map;
  }, [renderableRows]);
  
  if (visibleTasks.length === 0 && !defaultDateRange) {
    return <div className="flex h-full w-full items-center justify-center"><p>Loading timeline...</p></div>
  }
  
  const totalHeight = renderableRows.length * rowHeight;

  return (
    <div className="h-full w-full relative">
       <div className="absolute top-2 left-2 z-30 flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
            </Button>
        </div>
      <ScrollAreaPrimitive.Root className="h-full w-full relative overflow-hidden">
        <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit]" onScroll={onScroll}>
          <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
            <TimelineHeader startDate={viewStartDate} endDate={viewEndDate} scale={scale} />
            <div className="relative h-full" style={{height: `${totalHeight}px`}}>
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
                        />
                    );
                }
                return null;
              })}
              <DependencyLines 
                links={links} 
                taskBarElements={taskBarElements}
                taskIndexMap={taskIndexMap}
                rowHeight={rowHeight}
              />
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
