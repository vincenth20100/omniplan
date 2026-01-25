'use client';

import { useReducer, useEffect, useState } from 'react';
import type { ProjectState, Task, Link } from '@/lib/types';
import { initialTasks, initialLinks } from '@/lib/mock-data';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';

const initialVisibleColumns = ['wbs', 'name', 'start', 'finish'];

const initialState: ProjectState = {
  tasks: [],
  links: initialLinks,
  zones: [],
  historyLog: [],
  selectedTaskId: null,
  visibleColumns: initialVisibleColumns,
};

type Action =
  | { type: 'INIT_STATE'; payload: ProjectState }
  | { type: 'SCHEDULE_PROJECT' }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'SELECT_TASK'; payload: string | null }
  | { type: 'SET_CONFLICTS'; payload: { taskId: string, conflictDescription: string }[] }
  | { type: 'TOGGLE_TASK_COLLAPSE'; payload: { taskId: string } }
  | { type: 'MOVE_SELECTION'; payload: { direction: 'up' | 'down' } }
  | { type: 'SET_COLUMNS'; payload: string[] }
  | { type: 'INDENT_TASK' }
  | { type: 'OUTDENT_TASK' };


function updateHierarchyAndSort(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map(t => ({ ...t })).map(t => [t.id, t]));
    
    // Clear parent if parent doesn't exist
    for (const task of taskMap.values()) {
        if (task.parentId && !taskMap.has(task.parentId)) {
            task.parentId = null;
        }
    }

    const rootTasks = Array.from(taskMap.values()).filter(t => !t.parentId);

    const originalIndices = new Map(tasks.map((t, i) => [t.id, i]));
    rootTasks.sort((a, b) => (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0));
    
    const childrenMap = new Map<string, string[]>();
    for (const task of taskMap.values()) {
        if (task.parentId) {
            if (!childrenMap.has(task.parentId)) childrenMap.set(task.parentId, []);
            childrenMap.get(task.parentId)!.push(task.id);
        }
    }

    for (const children of childrenMap.values()) {
        children.sort((a, b) => (originalIndices.get(a) ?? 0) - (originalIndices.get(b) ?? 0));
    }

    function traverse(taskId: string, level: number, wbs: string) {
        const task = taskMap.get(taskId)!;
        task.level = level;
        task.wbs = wbs;

        const childrenIds = childrenMap.get(taskId) || [];
        childrenIds.forEach((childId, index) => {
            traverse(childId, level + 1, `${wbs}.${index + 1}`);
        });
    }

    rootTasks.forEach((task, index) => {
        traverse(task.id, 0, `${index + 1}`);
    });

    const finalTasks = Array.from(taskMap.values());
    finalTasks.sort((a, b) => (a.wbs || '').localeCompare(b.wbs || '', undefined, { numeric: true, sensitivity: 'base' }));

    return finalTasks;
}

function projectReducer(state: ProjectState, action: Action): ProjectState {
  const runScheduler = (tasks: Task[], links: Link[]): Task[] => {
      return calculateSchedule(tasks, links);
  };

  const getVisibleTasks = (tasks: Task[]): Task[] => {
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      return tasks.filter(task => {
          if (!task.parentId) return true;
          let parent = taskMap.get(task.parentId);
          while(parent) {
              if (parent.isCollapsed) return false;
              parent = taskMap.get(parent.parentId || '');
          }
          return true;
      });
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
        if (updatedTask && !updatedTask.isSummary) {
          if (updates.start && !updates.duration) {
            updatedTask.duration = calendarService.getWorkingDaysDuration(updatedTask.start, updatedTask.finish);
          } else if (updates.duration && updatedTask.start) {
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
      case 'TOGGLE_TASK_COLLAPSE': {
        const newTasks = state.tasks.map(task => 
          task.id === action.payload.taskId ? { ...task, isCollapsed: !task.isCollapsed } : task
        );
        return { ...state, tasks: newTasks };
      }
      case 'MOVE_SELECTION': {
        const visibleTasks = getVisibleTasks(state.tasks);
        if (visibleTasks.length === 0) return state;

        const currentId = state.selectedTaskId;
        const currentIndex = currentId ? visibleTasks.findIndex(t => t.id === currentId) : -1;
        
        if (currentIndex === -1) {
             return { ...state, selectedTaskId: visibleTasks[0]?.id || null };
        }
        
        const { direction } = action.payload;
        let nextIndex = currentIndex + (direction === 'up' ? -1 : 1);
        nextIndex = Math.max(0, Math.min(nextIndex, visibleTasks.length - 1));

        return { ...state, selectedTaskId: visibleTasks[nextIndex]?.id || null };
      }
      case 'SET_COLUMNS': {
        return { ...state, visibleColumns: action.payload };
      }
      case 'INDENT_TASK': {
        if (!state.selectedTaskId) return state;

        const sortedTasks = [...state.tasks].sort((a,b) => (a.wbs || "").localeCompare(b.wbs || ""));
        const taskIndex = sortedTasks.findIndex(t => t.id === state.selectedTaskId);
        const task = sortedTasks[taskIndex];

        if (taskIndex === 0 || !task || task.isSummary) return state;
        
        const potentialParent = sortedTasks[taskIndex - 1];

        if (potentialParent.level < task.level || potentialParent.isSummary) return state;
        
        let newTasks = state.tasks.map(t => {
            if (t.id === task.id) {
                return { ...t, parentId: potentialParent.id };
            }
            return t;
        });

        newTasks = updateHierarchyAndSort(newTasks);
        const reScheduledTasks = runScheduler(newTasks, state.links);
        return { ...state, tasks: reScheduledTasks };
      }
      case 'OUTDENT_TASK': {
        if (!state.selectedTaskId) return state;

        const task = state.tasks.find(t => t.id === state.selectedTaskId);
        if (!task || !task.parentId) return state;

        const parent = state.tasks.find(t => t.id === task.parentId);
        if (!parent) return state;
        
        let newTasks = state.tasks.map(t => {
          if (t.id === task.id) {
            return { ...t, parentId: parent.parentId };
          }
          return t;
        });

        newTasks = updateHierarchyAndSort(newTasks);
        const reScheduledTasks = runScheduler(newTasks, state.links);
        return { ...state, tasks: reScheduledTasks };
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }
      
      if (event.shiftKey && event.altKey) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          dispatch({ type: 'INDENT_TASK' });
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          dispatch({ type: 'OUTDENT_TASK' });
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        dispatch({ type: 'MOVE_SELECTION', payload: { direction: 'up' } });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        dispatch({ type: 'MOVE_SELECTION', payload: { direction: 'down' } });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const tasksWithDefaults = initialTasks.map(t => ({
      ...t,
      level: t.level || 0,
      isSummary: !!t.isSummary,
      isCollapsed: !!t.isCollapsed,
    }));

    const tasksWithDates: Task[] = tasksWithDefaults.map(t => ({
      ...t,
      start: new Date(t.start),
      finish: new Date(t.finish),
      constraintDate: t.constraintDate ? new Date(t.constraintDate) : undefined,
    }));
    
    const scheduledTasks = calculateSchedule(tasksWithDates, initialLinks);
    dispatch({ type: 'INIT_STATE', payload: { ...initialState, tasks: scheduledTasks, links: initialLinks, visibleColumns: initialVisibleColumns } });
    setIsLoaded(true);
  }, []);

  return { state, dispatch, isLoaded };
}
