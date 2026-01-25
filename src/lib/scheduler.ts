import type { Task, Link } from './types';
import { calendarService } from './calendar';
import { startOfDay } from 'date-fns';

export function calculateSchedule(tasks: Task[], links: Link[]): Task[] {
  const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
  const scheduledTasks = new Set<string>();

  const adj: Record<string, string[]> = {};
  tasks.forEach(task => adj[task.id] = []);
  links.forEach(link => {
    if (adj[link.source]) {
      adj[link.source].push(link.target);
    }
  });

  const inDegree: Record<string, number> = {};
  tasks.forEach(task => inDegree[task.id] = 0);
  links.forEach(link => {
    if (inDegree[link.target] !== undefined) {
      inDegree[link.target]++;
    }
  });

  const queue = tasks.filter(task => inDegree[task.id] === 0);

  queue.forEach(task => {
    const taskFromMap = taskMap.get(task.id)!;
    
    let newStart = calendarService.findNextWorkingDay(taskFromMap.start);
    
    if (taskFromMap.constraintType === 'Start No Earlier Than' && taskFromMap.constraintDate && taskFromMap.constraintDate > newStart) {
        newStart = calendarService.findNextWorkingDay(taskFromMap.constraintDate);
    }
    if (taskFromMap.constraintType === 'Must Start On' && taskFromMap.constraintDate) {
        newStart = calendarService.findNextWorkingDay(taskFromMap.constraintDate);
    }

    taskFromMap.start = newStart;
    taskFromMap.finish = calendarService.addWorkingDays(taskFromMap.start, taskFromMap.duration > 0 ? taskFromMap.duration -1 : 0);
    taskMap.set(task.id, taskFromMap);
  });
  
  let count = 0;
  while (queue.length > 0) {
    const taskId = queue.shift()!.id;
    scheduledTasks.add(taskId);
    count++;
    
    const currentTask = taskMap.get(taskId)!;
    
    // Process predecessors for the current task
    const predecessors = links.filter(l => l.target === taskId);
    let newStartDate = currentTask.start;
    
    predecessors.forEach(link => {
      if (link.type === 'FS') {
        const sourceTask = taskMap.get(link.source)!;
        const potentialStartDate = calendarService.addWorkingDays(sourceTask.finish, 1 + (link.lag || 0));
        if (potentialStartDate > newStartDate) {
          newStartDate = potentialStartDate;
        }
      }
    });

    let conflict = false;
    if (currentTask.constraintType && currentTask.constraintDate) {
      const constraintDate = startOfDay(currentTask.constraintDate);
      if (currentTask.constraintType === 'Must Start On') {
        if (startOfDay(newStartDate) > constraintDate) {
          conflict = true;
        } else {
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

    // Process successors
    (adj[taskId] || []).forEach(successorId => {
      inDegree[successorId]--;
      if (inDegree[successorId] === 0) {
        queue.push(taskMap.get(successorId)!);
      }
    });
  }

  if (count !== tasks.length) {
    console.error("Cycle detected in graph or error in scheduling");
    // Handle cycle - for now, return original tasks
    return tasks;
  }

  return Array.from(taskMap.values());
}
