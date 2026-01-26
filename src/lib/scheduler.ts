'use client';
import type { Task, Link, ColumnSpec } from './types';
import { calendarService } from './calendar';
import { startOfDay, min, max } from 'date-fns';

function updateAllSummaryTasks(tasks: Task[], links: Link[], columns?: ColumnSpec[]): Task[] {
    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
    
    // Sort tasks by level in descending order. This ensures we process children before their parents.
    const sortedByLevel = Array.from(taskMap.values())
        .filter(t => t.isSummary)
        .sort((a, b) => (b.level || 0) - (a.level || 0));

    for (const summaryTask of sortedByLevel) {
        const children = Array.from(taskMap.values()).filter(child => child.parentId === summaryTask.id);
        
        if (children.length > 0) {
            summaryTask.start = new Date(Math.min(...children.map(c => c.start.getTime())));
            summaryTask.finish = new Date(Math.max(...children.map(c => c.finish.getTime())));
            summaryTask.duration = calendarService.getWorkingDaysDuration(summaryTask.start, summaryTask.finish);
            summaryTask.cost = children.reduce((acc, c) => acc + (c.cost || 0), 0);
            
            const childrenTotalDuration = children.reduce((acc, c) => acc + (c.duration || 0), 0);
            summaryTask.percentComplete = childrenTotalDuration > 0
                ? Math.round(children.reduce((acc, c) => acc + ((c.percentComplete || 0) * (c.duration || 0)), 0) / childrenTotalDuration)
                : 0;
            
            if (columns) {
                columns.forEach(col => {
                    if (col.id.startsWith('custom-') && col.type === 'number') {
                        const sum = children.reduce((acc, c) => acc + (Number(c.customAttributes?.[col.id]) || 0), 0);
                        if (!summaryTask.customAttributes) summaryTask.customAttributes = {};
                        summaryTask.customAttributes[col.id] = sum;
                    }
                });
            }

        } else { // Summary task with no children should have zeroed-out values
            summaryTask.duration = 0;
            summaryTask.finish = summaryTask.start;
            summaryTask.percentComplete = 0;
            summaryTask.cost = 0;
        }

        taskMap.set(summaryTask.id, summaryTask);
    }
    
    return Array.from(taskMap.values());
}

export function calculateSchedule(tasks: Task[], links: Link[], columns?: ColumnSpec[]): Task[] {
  // DIAGNOSTIC STEP: Return tasks without recalculating to test for infinite loops.
  return tasks;
}
