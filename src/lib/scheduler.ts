'use client';
import type { Task, Link, ColumnSpec } from './types';
import { calendarService } from './calendar';
import { startOfDay, min, max } from 'date-fns';

function updateAllSummaryTasks(tasks: Task[], links: Link[], columns?: ColumnSpec[]): Task[] {
    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
    
    // We iterate based on the max depth of the project. This ensures values propagate
    // from the lowest-level children up to the top-level summaries without needing
    // a `while(changed)` loop, which was the source of the infinite loop.
    const maxLevels = Math.max(0, ...Array.from(taskMap.values()).map(t => t.level || 0));

    for (let i = 0; i <= maxLevels; i++) {
        for (const task of taskMap.values()) {
            if (!task.isSummary) continue;

            const children = Array.from(taskMap.values()).filter(t => t.parentId === task.id);
            
            if (children.length > 0) {
                // Recalculate summary fields based on children
                task.start = new Date(Math.min(...children.map(c => c.start.getTime())));
                task.finish = new Date(Math.max(...children.map(c => c.finish.getTime())));
                task.duration = calendarService.getWorkingDaysDuration(task.start, task.finish);
                task.cost = children.reduce((acc, c) => acc + (c.cost || 0), 0);

                const childrenTotalDuration = children.reduce((acc, c) => acc + (c.duration || 0), 0);
                task.percentComplete = childrenTotalDuration > 0
                    ? Math.round(children.reduce((acc, c) => acc + ((c.percentComplete || 0) * (c.duration || 0)), 0) / childrenTotalDuration)
                    : 0;

                // Recalculate custom number columns
                if (columns) {
                    const numberColumns = columns.filter(c => c.id.startsWith('custom-') && c.type === 'number');
                    if (numberColumns.length > 0) {
                        const newCustomAttributes = { ...(task.customAttributes || {}) };
                        for (const col of numberColumns) {
                            newCustomAttributes[col.id] = children.reduce((acc, c) => acc + (Number(c.customAttributes?.[col.id]) || 0), 0);
                        }
                        task.customAttributes = newCustomAttributes;
                    }
                }
            } else { // Summary task with no children should have zeroed-out values
                task.duration = 0;
                task.finish = task.start;
                task.percentComplete = 0;
                task.cost = 0;
                
                if (columns && task.customAttributes) {
                    const numberColumns = columns.filter(c => c.id.startsWith('custom-') && c.type === 'number');
                    if (numberColumns.length > 0) {
                        const newCustomAttributes = { ...(task.customAttributes || {}) };
                        let customChanged = false;
                        for (const col of numberColumns) {
                            if (newCustomAttributes[col.id] !== 0 && newCustomAttributes[col.id] !== undefined) {
                                newCustomAttributes[col.id] = 0;
                                customChanged = true;
                            }
                        }
                        if (customChanged) {
                           task.customAttributes = newCustomAttributes;
                        }
                    }
                }
            }
        }
    }
    
    return Array.from(taskMap.values());
}

export function calculateSchedule(tasks: Task[], links: Link[], columns?: ColumnSpec[]): Task[] {
  const allTasksMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
  const nonSummaryTasks = tasks.filter(t => !t.isSummary);

  const taskMap = new Map<string, Task>(nonSummaryTasks.map(task => [task.id, { ...task }]));
  
  const adj: Record<string, string[]> = {};
  nonSummaryTasks.forEach(task => adj[task.id] = []);
  links.forEach(link => {
    if (adj[link.source] && taskMap.has(link.target)) {
      adj[link.source].push(link.target);
    }
  });

  const inDegree: Record<string, number> = {};
  nonSummaryTasks.forEach(task => inDegree[task.id] = 0);
  links.forEach(link => {
    const sourceTask = allTasksMap.get(link.source);
    if (
      inDegree[link.target] !== undefined &&
      sourceTask &&
      !sourceTask.isSummary
    ) {
      inDegree[link.target]++;
    }
  });

  const queue = nonSummaryTasks.filter(task => inDegree[task.id] === 0);
  
  // Initialize start/finish based on constraints for tasks with no predecessors
  queue.forEach(task => {
    const taskFromMap = taskMap.get(task.id)!;
    let newStart = calendarService.findNextWorkingDay(taskFromMap.start);
     if (taskFromMap.constraintType === 'Must Start On' && taskFromMap.constraintDate) {
        newStart = calendarService.findNextWorkingDay(taskFromMap.constraintDate);
    } else if (taskFromMap.constraintType === 'Start No Earlier Than' && taskFromMap.constraintDate && taskFromMap.constraintDate > newStart) {
        newStart = calendarService.findNextWorkingDay(taskFromMap.constraintDate);
    }
    taskFromMap.start = newStart;
    taskFromMap.finish = calendarService.addWorkingDays(taskFromMap.start, taskFromMap.duration > 0 ? taskFromMap.duration -1 : 0);
    taskMap.set(task.id, taskFromMap);
  });
  
  let count = 0;
  while (queue.length > 0) {
    queue.sort((a,b) => (a.wbs || '').localeCompare(b.wbs || ''));
    const taskId = queue.shift()!.id;
    count++;
    
    const currentTask = taskMap.get(taskId)!;
    
    const predecessors = links.filter(l => l.target === taskId);
    let newStartDate = currentTask.start;
    let drivingLinkSource: string | null = null;

    predecessors.forEach(link => {
      const sourceTask = allTasksMap.get(link.source);
      if(!sourceTask) return;

      // If the source is a summary task, we need to use its finish date from the map.
      const resolvedSourceTask = taskMap.has(link.source) ? taskMap.get(link.source)! : allTasksMap.get(link.source)!;

      let potentialStartDate: Date;

      switch (link.type) {
        case 'SS':
          potentialStartDate = calendarService.addWorkingDays(resolvedSourceTask.start, link.lag || 0);
          break;
        case 'FF':
          {
            const successorDuration = currentTask.duration > 0 ? currentTask.duration - 1 : 0;
            const targetFinish = calendarService.addWorkingDays(resolvedSourceTask.finish, link.lag || 0);
            potentialStartDate = calendarService.addWorkingDays(targetFinish, -successorDuration);
          }
          break;
        case 'SF':
          {
            const successorDuration = currentTask.duration > 0 ? currentTask.duration - 1 : 0;
            const targetFinish = calendarService.addWorkingDays(resolvedSourceTask.start, link.lag || 0);
            potentialStartDate = calendarService.addWorkingDays(targetFinish, -successorDuration);
          }
          break;
        case 'FS':
        default:
          potentialStartDate = calendarService.addWorkingDays(resolvedSourceTask.finish, (link.lag || 0) + 1);
          break;
      }
        
        if (potentialStartDate > newStartDate) {
          newStartDate = potentialStartDate;
          drivingLinkSource = resolvedSourceTask.id;
        }
    });

    links.forEach(link => {
        if(link.target === taskId) {
            link.isDriving = link.source === drivingLinkSource;
        }
    });

    let conflict = false;
    if (currentTask.constraintType && currentTask.constraintDate) {
      const constraintDate = startOfDay(currentTask.constraintDate);
       if (currentTask.constraintType === 'Must Start On') {
        if (startOfDay(newStartDate) > constraintDate) {
          conflict = true;
        } else if (startOfDay(newStartDate) < constraintDate) {
          newStartDate = constraintDate;
        }
      } else if (currentTask.constraintType === 'Start No Earlier Than') {
        if (newStartDate < constraintDate) {
          newStartDate = constraintDate;
        }
      }
    }
    
    currentTask.start = newStartDate;
    currentTask.finish = calendarService.addWorkingDays(currentTask.start, currentTask.duration > 0 ? currentTask.duration -1 : 0);
    currentTask.schedulingConflict = conflict;
    
    taskMap.set(taskId, currentTask);

    (adj[taskId] || []).forEach(successorId => {
      inDegree[successorId]--;
      if (inDegree[successorId] === 0) {
        queue.push(taskMap.get(successorId)!);
      }
    });
  }

  if (count !== nonSummaryTasks.length) {
    console.error("Cycle detected in graph or error in scheduling. Scheduled " + count + " of " + nonSummaryTasks.length);
  }

  for(const task of taskMap.values()) {
      allTasksMap.set(task.id, task);
  }

  const resultWithSummaries = updateAllSummaryTasks(Array.from(allTasksMap.values()), links, columns);
  
  resultWithSummaries.sort((a, b) => (a.wbs || '').localeCompare(b.wbs || ''));

  return resultWithSummaries;
}
