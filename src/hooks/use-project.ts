'use client';

import { useReducer, useEffect, useState } from 'react';
import type { ProjectState, Task, Link } from '@/lib/types';
import { initialTasks, initialLinks } from '@/lib/mock-data';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';

const tasksWithDates: Task[] = initialTasks.map(t => ({
  ...t,
  start: new Date(t.start),
  finish: new Date(t.finish),
  constraintDate: t.constraintDate ? new Date(t.constraintDate) : undefined,
}));

const initialState: ProjectState = {
  tasks: [],
  links: initialLinks,
  zones: [],
  historyLog: [],
  selectedTaskId: null,
};

type Action =
  | { type: 'INIT_STATE'; payload: ProjectState }
  | { type: 'SCHEDULE_PROJECT' }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'SELECT_TASK'; payload: string | null }
  | { type: 'SET_CONFLICTS'; payload: { taskId: string, conflictDescription: string }[] };

function projectReducer(state: ProjectState, action: Action): ProjectState {
  const runScheduler = (tasks: Task[], links: Link[]): Task[] => {
      return calculateSchedule(tasks, links);
  };
    
  const newState = ((): ProjectState => {
    switch (action.type) {
      case 'INIT_STATE':
        return action.payload;

      case 'SCHEDULE_PROJECT': {
        const scheduledTasks = runScheduler(state.tasks, state.links);
        return { ...state, tasks: scheduledTasks };
      }

      case 'UPDATE_TASK': {
        const { id, ...updates } = action.payload;
        let newTasks = state.tasks.map(task =>
          task.id === id ? { ...task, ...updates } : task
        );
        
        const updatedTask = newTasks.find(t => t.id === id);
        if (updatedTask) {
          if (updates.start && !updates.duration) {
            updatedTask.duration = calendarService.getWorkingDaysDuration(updatedTask.start, updatedTask.finish);
          } else if (updates.duration && updates.start) {
             updatedTask.finish = calendarService.addWorkingDays(updatedTask.start, updatedTask.duration > 0 ? updatedTask.duration - 1: 0);
          }
        }
        
        const reScheduledTasks = runScheduler(newTasks, state.links);
        return { ...state, tasks: reScheduledTasks };
      }
      case 'SELECT_TASK': {
        return { ...state, selectedTaskId: action.payload };
      }
      case 'SET_CONFLICTS': {
        const conflictIds = new Set(action.payload.map(c => c.taskId));
        const newTasks = state.tasks.map(task => ({
          ...task,
          schedulingConflict: task.schedulingConflict || conflictIds.has(task.id)
        }));
        return { ...state, tasks: newTasks };
      }
      default:
        return state;
    }
  })();
  
  if (action.type !== 'INIT_STATE') {
    return { ...newState, historyLog: [...state.historyLog, { action, timestamp: new Date() }] };
  }
  return newState;
}

export function useProject() {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const scheduledTasks = calculateSchedule(tasksWithDates, initialLinks);
    dispatch({ type: 'INIT_STATE', payload: { ...initialState, tasks: scheduledTasks } });
    setIsLoaded(true);
  }, []);

  return { state, dispatch, isLoaded };
}
