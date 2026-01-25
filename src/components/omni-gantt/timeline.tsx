'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { ProjectState, Task, Link } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TimelineHeader } from './timeline-header';
import { TaskBar } from './task-bar';
import { DependencyLines } from './dependency-lines';
import { addDays, differenceInDays, min, max, startOfDay } from 'date-fns';

const VIEW_PADDING_DAYS = 30;
const DAY_SCALE = 35; // pixels per day

export function Timeline({ tasks, links, dispatch, selectedTaskId }: { tasks: Task[], links: Link[], dispatch: any, selectedTaskId: string | null }) {
  const [taskBarElements, setTaskBarElements] = useState<Record<string, HTMLDivElement | null>>({});

  const { viewStartDate, viewEndDate } = useMemo(() => {
    if (tasks.length === 0) {
      const today = startOfDay(new Date());
      return {
        viewStartDate: addDays(today, -VIEW_PADDING_DAYS),
        viewEndDate: addDays(today, VIEW_PADDING_DAYS),
      };
    }
    const minDate = min(tasks.map(t => t.start));
    const maxDate = max(tasks.map(t => t.finish));
    return {
      viewStartDate: addDays(minDate, -15),
      viewEndDate: addDays(maxDate, 15),
    };
  }, [tasks]);

  const totalWidth = useMemo(() => {
    return (differenceInDays(viewEndDate, viewStartDate) + 1) * DAY_SCALE;
  }, [viewStartDate, viewEndDate]);

  const registerBarElement = (taskId: string, element: HTMLDivElement | null) => {
    setTaskBarElements(prev => ({ ...prev, [taskId]: element }));
  };

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
            ganttStartDate={viewStartDate} 
            scale={DAY_SCALE} 
            taskBarElements={taskBarElements} 
          />
        </div>
      </div>
    </ScrollArea>
  );
}
