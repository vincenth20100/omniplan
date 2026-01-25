import type { Task, Link } from './types';
import { calendarService } from './calendar';
import { startOfDay, min, max } from 'date-fns';

function updateAllSummaryTasks(tasks: Task[], links: Link[]): Task[] {
    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
    let changed = true;
    let iterations = 0; // safety break for potential infinite loops

    while(changed && iterations < 10) {
        changed = false;
        iterations++;
        
        for (const task of taskMap.values()) {
            if (task.isSummary) {
                const children = Array.from(taskMap.values()).filter(t => t.parentId === task.id);
                
                if (children.length > 0 && children.every(c => c.start && c.finish)) {
                    const oldStartMs = task.start?.getTime();
                    const oldFinishMs = task.finish?.getTime();
                    
                    const newStart = min(children.map(c => c.start));
                    const newFinish = max(children.map(c => c.finish));

                    if (newStart.getTime() !== oldStartMs || newFinish.getTime() !== oldFinishMs) {
                        task.start = newStart;
                        task.finish = newFinish;
                        task.duration = calendarService.getWorkingDaysDuration(newStart, newFinish);
                        
                        const childrenTotalDuration = children.reduce((acc, c) => acc + (c.duration || 0), 0);
                        const childrenWeightedComplete = children.reduce((acc, c) => acc + ((c.percentComplete || 0) * (c.duration || 0)), 0);
                        task.percentComplete = childrenTotalDuration > 0 ? Math.round(childrenWeightedComplete / childrenTotalDuration) : 0;
                        
                        taskMap.set(task.id, task);
                        changed = true;
                    }
                }
            }
        }
    }
    return Array.from(taskMap.values());
}

export function calculateSchedule(tasks: Task[], links: Link[]): Task[] {
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
    if (inDegree[link.target] !== undefined) {
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
      const sourceTask = taskMap.get(link.source);
      if(!sourceTask) return;

      if (link.type === 'FS') {
        const potentialStartDate = calendarService.addWorkingDays(sourceTask.finish, (link.lag || 0) + 1);
        if (potentialStartDate > newStartDate) {
          newStartDate = potentialStartDate;
          drivingLinkSource = sourceTask.id;
        }
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
    // return tasks;
  }

  for(const task of taskMap.values()) {
      allTasksMap.set(task.id, task);
  }

  const resultWithSummaries = updateAllSummaryTasks(Array.from(allTasksMap.values()), links);
  
  resultWithSummaries.sort((a, b) => (a.wbs || '').localeCompare(b.wbs || ''));

  return resultWithSummaries;
}
