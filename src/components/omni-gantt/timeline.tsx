'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Task, Link } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineHeader } from './timeline-header';
import { TaskBar } from './task-bar';
import { DependencyLines } from './dependency-lines';
import { addDays, differenceInDays, min, max, startOfDay } from 'date-fns';

const VIEW_PADDING_DAYS = 30;
const DAY_SCALE = 35; // pixels per day

export function Timeline({ tasks, links, dispatch, selectedTaskId }: { tasks: Task[], links: Link[], dispatch: any, selectedTaskId: string | null }) {
  const [taskBarElements, setTaskBarElements] = useState<Record<string, HTMLDivElement | null>>({});
  const [defaultDateRange, setDefaultDateRange] = useState<{viewStartDate: Date, viewEndDate: Date} | null>(null);

  useEffect(() => {
      // This will only run on the client, preventing hydration mismatch
      const today = startOfDay(new Date());
      setDefaultDateRange({
          viewStartDate: addDays(today, -VIEW_PADDING_DAYS),
          viewEndDate: addDays(today, VIEW_PADDING_DAYS),
      });
  }, []);

  const { viewStartDate, viewEndDate } = useMemo(() => {
    if (tasks.length > 0) {
        const minDate = min(tasks.map(t => t.start));
        const maxDate = max(tasks.map(t => t.finish));
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
  }, [tasks, defaultDateRange]);

  const totalWidth = useMemo(() => {
    return (differenceInDays(viewEndDate, viewStartDate) + 1) * DAY_SCALE;
  }, [viewStartDate, viewEndDate]);

  const registerBarElement = useCallback((taskId: string, element: HTMLDivElement | null) => {
    setTaskBarElements(prev => ({ ...prev, [taskId]: element }));
  }, []);
  
  if (tasks.length === 0 && !defaultDateRange) {
    return <div className="flex h-full w-full items-center justify-center"><p>Loading timeline...</p></div>
  }

  return (
    <ScrollArea className="h-full w-full">
      <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
        <TimelineHeader startDate={viewStartDate} endDate={viewEndDate} scale={DAY_SCALE} />
        <div className="relative h-full">
          {tasks.map((task, index) => (
            <TaskBar
              key={task.id}
              task={task}
              ganttStartDate={viewStartDate}
              scale={DAY_SCALE}
              dispatch={dispatch}
              row={index}
              isSelected={task.id === selectedTaskId}
              onSelect={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
              registerBarElement={registerBarElement}
            />
          ))}
          <DependencyLines 
            tasks={tasks}
            links={links} 
            taskBarElements={taskBarElements} 
          />
        </div>
      </div>
    </ScrollArea>
  );
}
