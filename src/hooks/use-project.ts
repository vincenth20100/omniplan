'use client';

import { useReducer, useEffect, useState, useRef } from 'react';
import type { ProjectState, Task, Link, ColumnSpec, UiDensity, LinkType, Resource, Assignment, Calendar, Exception, View, Note, Filter, GanttSettings } from '@/lib/types';
import { initialTasks, initialLinks, initialResources, initialAssignments, initialCalendars } from '@/lib/mock-data';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';
import { format } from 'date-fns';

const ALL_COLUMNS: (Omit<ColumnSpec, 'width'> & { defaultWidth: number })[] = [
    { id: 'wbs', name: 'WBS', defaultWidth: 50, type: 'text' },
    { id: 'schedulingMode', name: 'I', defaultWidth: 30, type: 'text' },
    { id: 'name', name: 'Task Name', defaultWidth: 250, type: 'text' },
    { id: 'resourceNames', name: 'Resource Names', defaultWidth: 150, type: 'text' },
    { id: 'duration', name: 'Duration', defaultWidth: 80, type: 'number' },
    { id: 'start', name: 'Start', defaultWidth: 110, type: 'date' },
    { id: 'finish', name: 'Finish', defaultWidth: 110, type: 'date' },
    { id: 'cost', name: 'Cost', defaultWidth: 100, type: 'number' },
    { id: 'predecessors', name: 'Predecessors', defaultWidth: 120, type: 'text' },
    { id: 'successors', name: 'Successors', defaultWidth: 120, type: 'text' },
    { id: 'percentComplete', name: '% Complete', defaultWidth: 80, type: 'number' },
    { id: 'constraintType', name: 'Constraint Type', defaultWidth: 110, type: 'selection', options: [
        'Finish No Earlier Than',
        'Finish No Later Than',
        'Must Finish On',
        'Must Start On',
        'Start No Earlier Than',
        'Start No Later Than',
    ] },
    { id: 'constraintDate', name: 'Constraint Date', defaultWidth: 110, type: 'date' },
];

const initialColumns: ColumnSpec[] = ALL_COLUMNS.map(c => ({ id: c.id, name: c.name, width: c.defaultWidth, type: c.type, options: c.options }));

const initialVisibleColumns = ['wbs', 'schedulingMode', 'name', 'duration', 'start', 'finish'];

const defaultViews: View[] = [
    { id: 'default', name: 'Default View', grouping: [], visibleColumns: initialVisibleColumns, filters: [] }
];

const initialGanttSettings: GanttSettings = {
  viewMode: 'day',
  showDependencies: true,
  showProgress: true,
  highlightNonWorkingTime: true,
  showTodayLine: true,
  showTaskLabels: true,
  highlightCriticalPath: true,
};

const initialState: ProjectState = {
  tasks: [],
  links: [],
  resources: [],
  assignments: [],
  zones: [],
  calendars: [],
  defaultCalendarId: null,
  historyLog: [],
  selectedTaskIds: [],
  visibleColumns: initialVisibleColumns,
  columns: initialColumns,
  uiDensity: 'compact',
  grouping: [],
  filters: [],
  views: defaultViews,
  currentViewId: 'default',
  isDirty: false,
  multiSelectMode: false,
  activeCell: null,
  editingCell: null,
  ganttSettings: initialGanttSettings,
};

type Action =
  | { type: 'INIT_STATE'; payload: ProjectState }
  | { type: 'SCHEDULE_PROJECT' }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'UPDATE_LINK'; payload: Partial<Link> & { id: string } }
  | { type: 'SELECT_TASK'; payload: { taskId: string | null, ctrlKey?: boolean, shiftKey?: boolean } }
  | { type: 'LINK_TASKS' }
  | { type: 'ADD_LINK'; payload: { source: string, target: string, type: LinkType, lag: number } }
  | { type: 'SET_CONFLICTS'; payload: { taskId: string, conflictDescription: string }[] }
  | { type: 'TOGGLE_TASK_COLLAPSE'; payload: { taskId: string } }
  | { type: 'MOVE_SELECTION'; payload: { direction: 'up' | 'down' } }
  | { type: 'SET_COLUMNS'; payload: string[] }
  | { type: 'RESIZE_COLUMN'; payload: { columnId: string, width: number } }
  | { type: 'REORDER_COLUMNS'; payload: { sourceId: string, targetId: string } }
  | { type: 'INDENT_TASK' }
  | { type: 'OUTDENT_TASK' }
  | { type: 'ADD_TASK' }
  | { type: 'REMOVE_TASK' }
  | { type: 'REMOVE_LINK'; payload: { linkId: string } }
  | { type: 'REORDER_TASKS'; payload: { sourceIds: string[]; targetId: string; position: 'top' | 'bottom' } }
  | { type: 'NEST_TASKS', payload: { sourceIds: string[], parentId: string }}
  | { type: 'SET_UI_DENSITY', payload: UiDensity }
  | { type: 'UPDATE_RELATIONSHIPS', payload: { taskId: string, field: 'predecessors' | 'successors', value: string }}
  | { type: 'ADD_RESOURCE' }
  | { type: 'REMOVE_RESOURCE', payload: { resourceId: string } }
  | { type: 'UPDATE_RESOURCE', payload: Partial<Resource> & { id: string } }
  | { type: 'ADD_CALENDAR' }
  | { type: 'REMOVE_CALENDAR', payload: { calendarId: string } }
  | { type: 'UPDATE_CALENDAR', payload: Partial<Calendar> & { id: string } }
  | { type: 'ADD_COLUMN', payload: Omit<ColumnSpec, 'id'|'width'> & { width?: number } }
  | { type: 'UPDATE_COLUMN', payload: Partial<ColumnSpec> & { id: string } }
  | { type: 'REMOVE_COLUMN', payload: { columnId: string } }
  | { type: 'NEW_PROJECT' }
  | { type: 'LOAD_PROJECT', payload: ProjectState }
  | { type: 'SET_GROUPING', payload: string[] }
  | { type: 'SET_FILTERS', payload: Filter[] }
  | { type: 'SET_VIEW', payload: { viewId: string } }
  | { type: 'SAVE_VIEW_AS', payload: { name: string } }
  | { type: 'UPDATE_CURRENT_VIEW' }
  | { type: 'DELETE_VIEW', payload: { viewId: string } }
  | { type: 'TOGGLE_MULTI_SELECT_MODE' }
  | { type: 'ADD_NOTE_TO_TASK'; payload: { taskId: string; content: string } }
  | { type: 'ADD_TASKS_FROM_PASTE', payload: { data: string } }
  | { type: 'SET_ACTIVE_CELL'; payload: { taskId: string; columnId: string } | null }
  | { type: 'START_EDITING_CELL', payload: { taskId: string, columnId: string, initialValue?: string } }
  | { type: 'STOP_EDITING_CELL' }
  | { type: 'UPDATE_GANTT_SETTINGS', payload: GanttSettings }
  | { type: 'EXPAND_ALL' }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'UNDO' }
  | { type: 'REDO' };


function updateHierarchyAndSort(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map(t => ({ ...t })).map(t => [t.id, t]));
    
    // Clear parent if parent doesn't exist
    for (const task of taskMap.values()) {
        if (task.parentId && !taskMap.has(task.parentId)) {
            task.parentId = null;
        }
    }

    // Determine children for each task
    const childrenMap = new Map<string, string[]>();
    for (const task of taskMap.values()) {
        if (task.parentId) {
            if (!childrenMap.has(task.parentId)) childrenMap.set(task.parentId, []);
            childrenMap.get(task.parentId)!.push(task.id);
        }
    }
    
    // Set isSummary flag based on children
    for (const task of taskMap.values()) {
        task.isSummary = childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
    }

    const rootTasks = Array.from(taskMap.values()).filter(t => !t.parentId);

    const originalIndices = new Map(tasks.map((t, i) => [t.id, i]));
    rootTasks.sort((a, b) => (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0));
    
    // sort children by original index
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
  const runScheduler = (tasks: Task[], links: Link[], columns: ColumnSpec[], calendars: Calendar[], defaultCalendarId: string | null): Task[] => {
      const defaultCalendar = calendars.find(c => c.id === defaultCalendarId) || calendars[0];
      if (!defaultCalendar) {
          console.error("No default calendar found for scheduling.");
          return tasks;
      }
      const hierarchicalTasks = updateHierarchyAndSort(tasks);
      return calculateSchedule(hierarchicalTasks, links, columns, defaultCalendar);
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
        const scheduledTasks = runScheduler(state.tasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks };
      }

      case 'UPDATE_TASK': {
        const { id, ...updates } = action.payload;
        
        const taskBeingUpdated = state.tasks.find(t => t.id === id);
        if (taskBeingUpdated && !taskBeingUpdated.isSummary && updates.start && !updates.duration && !updates.finish) {
            const hasPredecessors = state.links.some(l => l.target === id);
            if (hasPredecessors) {
                updates.constraintType = 'Start No Earlier Than';
            } else {
                updates.constraintType = 'Must Start On';
            }
            updates.constraintDate = updates.start;
        }

        let newTasks = state.tasks.map(task =>
          task.id === id ? { ...task, ...updates } : task
        );
        
        const updatedTask = newTasks.find(t => t.id === id);
        const defaultCalendar = state.calendars.find(c => c.id === state.defaultCalendarId) || state.calendars[0];

        if (updatedTask && !updatedTask.isSummary && defaultCalendar) {
          // If start date is changed (e.g., by moving), update finish date to preserve duration
          if (updates.start !== undefined && updates.duration === undefined && updates.finish === undefined) {
            updatedTask.finish = calendarService.addWorkingDays(updatedTask.start, updatedTask.duration > 0 ? updatedTask.duration - 1 : 0, defaultCalendar);
          }
          // If duration is explicitly changed, update finish date
          else if (updates.duration !== undefined) {
            updatedTask.finish = calendarService.addWorkingDays(updatedTask.start, updatedTask.duration > 0 ? updatedTask.duration - 1 : 0, defaultCalendar);
          } 
          // If finish date is changed, update duration
          else if (updates.finish !== undefined) {
            if (updatedTask.start > updatedTask.finish) {
              updatedTask.start = updatedTask.finish; // Prevent finish from being before start
            }
            updatedTask.duration = calendarService.getWorkingDaysDuration(updatedTask.start, updatedTask.finish, defaultCalendar);
          }
        }
        
        const reScheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks };
      }
      case 'UPDATE_LINK': {
        const { id, ...updates } = action.payload;
        const newLinks = state.links.map(link =>
          link.id === id ? { ...link, ...updates } : link
        );
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, links: newLinks };
      }
      case 'SELECT_TASK': {
        const { taskId, ctrlKey, shiftKey } = action.payload;

        if (taskId === null) {
          return { ...state, selectedTaskIds: [] };
        }

        const visibleTasks = getVisibleTasks(state.tasks);
        
        if (shiftKey && state.selectedTaskIds.length > 0) {
            const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
            const lastSelectedIndex = visibleTasks.findIndex(t => t.id === lastSelectedId);
            const currentSelectedIndex = visibleTasks.findIndex(t => t.id === taskId);
            
            if (lastSelectedIndex !== -1 && currentSelectedIndex !== -1) {
                const start = Math.min(lastSelectedIndex, currentSelectedIndex);
                const end = Math.max(lastSelectedIndex, currentSelectedIndex);
                const rangeIds = visibleTasks.slice(start, end + 1).map(t => t.id);
                
                const newSelection = [...state.selectedTaskIds];
                rangeIds.forEach(id => {
                    if (!newSelection.includes(id)) {
                        newSelection.push(id);
                    }
                });

                return { ...state, selectedTaskIds: newSelection };
            }
        }

        if (ctrlKey || state.multiSelectMode) {
            const currentSelection = [...state.selectedTaskIds];
            const existingIndex = currentSelection.indexOf(taskId);
            if (existingIndex > -1) {
                currentSelection.splice(existingIndex, 1);
            } else {
                currentSelection.push(taskId);
            }
            return { ...state, selectedTaskIds: currentSelection };
        }

        return { ...state, selectedTaskIds: [taskId] };
      }
      case 'LINK_TASKS': {
        if (state.selectedTaskIds.length < 2) {
            return state;
        }
        const newLinks: Link[] = [];
        for (let i = 0; i < state.selectedTaskIds.length - 1; i++) {
            const sourceId = state.selectedTaskIds[i];
            const targetId = state.selectedTaskIds[i + 1];

            const linkExists = state.links.some(l => l.source === sourceId && l.target === targetId);
            if (!linkExists) {
                newLinks.push({
                    id: `l-${sourceId}-${targetId}-${Date.now()}-${i}`,
                    source: sourceId,
                    target: targetId,
                    type: 'FS',
                    lag: 0,
                });
            }
        }

        if (newLinks.length === 0) {
            return state;
        }

        const combinedLinks = [...state.links, ...newLinks];
        const reScheduledTasks = runScheduler(state.tasks, combinedLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, links: combinedLinks };
      }
      case 'ADD_LINK': {
        const { source, target, type, lag } = action.payload;

        const linkExists = state.links.some(l => l.source === source && l.target === target);
        if (linkExists) {
            return state;
        }

        const newLink: Link = {
            id: `l-${source}-${target}-${Date.now()}`,
            source,
            target,
            type,
            lag,
        };

        const newLinks = [...state.links, newLink];
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, links: newLinks };
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

        const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
        const currentIndex = lastSelectedId ? visibleTasks.findIndex(t => t.id === lastSelectedId) : -1;
        
        if (currentIndex === -1) {
             return { ...state, selectedTaskIds: [visibleTasks[0]?.id].filter(Boolean) };
        }
        
        const { direction } = action.payload;
        let nextIndex = currentIndex + (direction === 'up' ? -1 : 1);
        nextIndex = Math.max(0, Math.min(nextIndex, visibleTasks.length - 1));
        const nextTaskId = visibleTasks[nextIndex]?.id;

        return { ...state, selectedTaskIds: nextTaskId ? [nextTaskId] : [] };
      }
      case 'SET_COLUMNS': {
        return { ...state, visibleColumns: action.payload, isDirty: true };
      }
       case 'RESIZE_COLUMN': {
        const { columnId, width } = action.payload;
        const newColumns = state.columns.map(c =>
          c.id === columnId ? { ...c, width } : c
        );
        return { ...state, columns: newColumns, isDirty: true };
      }
      case 'REORDER_COLUMNS': {
        const { sourceId, targetId } = action.payload;
        const columns = [...state.columns];
        const sourceIndex = columns.findIndex(c => c.id === sourceId);
        const targetIndex = columns.findIndex(c => c.id === targetId);
    
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return state;
    
        const [removed] = columns.splice(sourceIndex, 1);
        columns.splice(targetIndex, 0, removed);
        
        return { ...state, columns, isDirty: true };
      }
      case 'INDENT_TASK': {
        if (state.selectedTaskIds.length === 0) return state;

        const tasksCopy = state.tasks.map(t => ({...t}));
        const taskMap = new Map(tasksCopy.map(t => [t.id, t]));
        
        const sortedTasks = [...tasksCopy].sort((a, b) => (a.wbs || '').localeCompare(b.wbs || '', undefined, { numeric: true, sensitivity: 'base' }));

        const firstSelectedTaskInOrder = sortedTasks.find(t => state.selectedTaskIds.includes(t.id));
        if (!firstSelectedTaskInOrder) return state;

        const firstSelectedIndex = sortedTasks.findIndex(t => t.id === firstSelectedTaskInOrder.id);
        if (firstSelectedIndex === 0) return state; // Cannot indent the first task

        const newParent = sortedTasks[firstSelectedIndex - 1];
        
        if (state.selectedTaskIds.includes(newParent.id)) return state; // Cannot indent a task under another selected task

        // Check if newParent is a descendant of any selected task
        for (const selectedTaskId of state.selectedTaskIds) {
            let current = taskMap.get(newParent.id);
            while (current?.parentId) {
                if (current.parentId === selectedTaskId) {
                    return state; // Can't indent under a child/descendant
                }
                current = taskMap.get(current.parentId);
            }
        }

        for (const taskId of state.selectedTaskIds) {
            const taskToUpdate = taskMap.get(taskId);
            if (taskToUpdate) {
                taskToUpdate.parentId = newParent.id;
            }
        }

        const newTasks = Array.from(taskMap.values());
        const reScheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks };
      }
      case 'OUTDENT_TASK': {
        if (state.selectedTaskIds.length === 0) return state;

        const tasksCopy = state.tasks.map(t => ({...t}));
        const taskMap = new Map(tasksCopy.map(t => [t.id, t]));
        
        // Update parentIds for all selected tasks
        state.selectedTaskIds.forEach(id => {
            const taskToUpdate = taskMap.get(id);
            if (taskToUpdate?.parentId) {
                const currentParent = taskMap.get(taskToUpdate.parentId);
                if (currentParent) {
                    taskToUpdate.parentId = currentParent.parentId ?? null;
                }
            }
        });
        
        const newTasks = Array.from(taskMap.values());
        const reScheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks };
      }
       case 'ADD_TASK': {
        const newTask: Task = {
            id: `T-${Date.now()}`,
            name: "New Task",
            start: new Date(),
            finish: new Date(),
            duration: 1,
            percentComplete: 0,
            cost: 0,
            level: 0,
        };

        let newTasks = [...state.tasks];
        const newSelectedIds = [newTask.id];

        if (state.selectedTaskIds.length > 0) {
            const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
            const selectedIndex = newTasks.findIndex(t => t.id === lastSelectedId);
            const selectedTask = newTasks[selectedIndex];
            if (selectedTask) {
              newTask.parentId = selectedTask.parentId;
              newTask.level = selectedTask.level;
            }
            if (selectedIndex !== -1) {
                newTasks.splice(selectedIndex + 1, 0, newTask);
            } else {
                newTasks.push(newTask);
            }
        } else {
            newTasks.push(newTask);
        }

        const reScheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, selectedTaskIds: newSelectedIds };
      }
      case 'REMOVE_TASK': {
        if (state.selectedTaskIds.length === 0) return state;

        const idsToRemove = new Set<string>();
        const queue: string[] = [];

        state.selectedTaskIds.forEach(id => {
            if (!idsToRemove.has(id)) {
                queue.push(id);
                while(queue.length > 0) {
                    const currentId = queue.shift()!;
                    if (!idsToRemove.has(currentId)) {
                        idsToRemove.add(currentId);
                        state.tasks.forEach(t => {
                            if(t.parentId === currentId) {
                                queue.push(t.id);
                            }
                        });
                    }
                }
            }
        });
        
        const newTasks = state.tasks.filter(t => !idsToRemove.has(t.id));
        const newLinks = state.links.filter(l => !idsToRemove.has(l.source) && !idsToRemove.has(l.target));
        
        const reScheduledTasks = runScheduler(newTasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);

        let activeCell = state.activeCell;
        if (activeCell && idsToRemove.has(activeCell.taskId)) {
            activeCell = null;
        }
        
        return { ...state, tasks: reScheduledTasks, links: newLinks, selectedTaskIds: [], activeCell };
      }
      case 'REMOVE_LINK': {
        const { linkId } = action.payload;
        const newLinks = state.links.filter(l => l.id !== linkId);
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, links: newLinks };
      }
      case 'REORDER_TASKS': {
        const { sourceIds, targetId, position } = action.payload;
        if (sourceIds.includes(targetId)) return state;

        const tasks = [...state.tasks];
        
        const sourceTasks = sourceIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[];
        if (sourceTasks.length !== sourceIds.length) return state;

        const remainingTasks = tasks.filter(t => !sourceIds.includes(t.id));

        let targetIndex = remainingTasks.findIndex(t => t.id === targetId);
        if (targetIndex === -1) return state;

        const targetTask = remainingTasks[targetIndex];
        
        sourceTasks.forEach(task => {
            task.parentId = targetTask.parentId;
        });

        if (position === 'bottom') {
            targetIndex++;
        }

        remainingTasks.splice(targetIndex, 0, ...sourceTasks);

        const reScheduledTasks = runScheduler(remainingTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        
        return { ...state, tasks: reScheduledTasks };
      }
      case 'NEST_TASKS': {
        const { sourceIds, parentId } = action.payload;
        if (sourceIds.includes(parentId)) return state;

        const tasksCopy = state.tasks.map(t => ({...t}));
        const taskMap = new Map(tasksCopy.map(t => [t.id, t]));

        const parentTask = taskMap.get(parentId);
        if (!parentTask) return state;

        for (const sourceId of sourceIds) {
            let p: Task | undefined = parentTask;
            while(p) {
                if (p.id === sourceId) return state; // Prevent nesting under a child
                p = p.parentId ? taskMap.get(p.parentId) : undefined;
            }
        }

        const sourceTasks: Task[] = [];
        sourceIds.forEach(id => {
            const task = taskMap.get(id);
            if (task) {
                task.parentId = parentId;
                sourceTasks.push(task);
            }
        });

        const remainingTasks = tasksCopy.filter(t => !sourceIds.includes(t.id));

        let parentIndex = remainingTasks.findIndex(t => t.id === parentId);
        
        const existingChildren = remainingTasks.filter(t => t.parentId === parentId);
        let insertAfterIndex = parentIndex;

        if (existingChildren.length > 0) {
            const wbsSortedChildren = existingChildren.sort((a,b) => (a.wbs || '').localeCompare(b.wbs || '', undefined, { numeric: true, sensitivity: 'base' }));
            const lastChildId = wbsSortedChildren[wbsSortedChildren.length-1].id;
            const lastChildIndex = remainingTasks.findIndex(t => t.id === lastChildId);
            insertAfterIndex = Math.max(parentIndex, lastChildIndex);
        }

        remainingTasks.splice(insertAfterIndex + 1, 0, ...sourceTasks);
        
        const reScheduledTasks = runScheduler(remainingTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        
        return { ...state, tasks: reScheduledTasks };
      }
      case 'SET_UI_DENSITY': {
        return { ...state, uiDensity: action.payload };
      }
      case 'UPDATE_RELATIONSHIPS': {
        const { taskId, field, value } = action.payload;

        const wbsToIdMap = new Map(state.tasks.map(t => [t.wbs, t.id]));
        
        const otherLinks = state.links.filter(link => {
            if (field === 'predecessors') return link.target !== taskId;
            if (field === 'successors') return link.source !== taskId;
            return true;
        });

        const newLinksForTask: Link[] = [];
        if (value.trim()) {
            const linkParts = value.split(',').map(s => s.trim()).filter(Boolean);
    
            for (const part of linkParts) {
                const match = part.match(/^([\d.]+)\s*([A-Z]{2})?\s*([+-]\d+d?)?$/i);
                if (!match) continue;
    
                const [, wbs, type, lagStr] = match;
                const linkedTaskId = wbsToIdMap.get(wbs);
                if (!linkedTaskId || linkedTaskId === taskId) continue;
    
                const linkType = (type?.toUpperCase() as LinkType) || 'FS';
                const lag = lagStr ? parseInt(lagStr.replace('d', ''), 10) : 0;
                
                let newLink: Link;
                if (field === 'predecessors') {
                    newLink = {
                        id: `l-${taskId}-${linkedTaskId}-${Math.random()}`,
                        source: linkedTaskId,
                        target: taskId,
                        type: linkType,
                        lag: lag
                    };
                } else { // successors
                    newLink = {
                        id: `l-${taskId}-${linkedTaskId}-${Math.random()}`,
                        source: taskId,
                        target: linkedTaskId,
                        type: linkType,
                        lag: lag
                    };
                }
                newLinksForTask.push(newLink);
            }
        }
        
        const newLinks = [...otherLinks, ...newLinksForTask];
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        
        return { ...state, tasks: reScheduledTasks, links: newLinks };
      }
      case 'ADD_RESOURCE': {
        const newResource: Resource = {
            id: `R-${Date.now()}`,
            name: 'New Resource',
            type: 'Work',
            availability: 1,
            costPerHour: 0,
        };
        return { ...state, resources: [...state.resources, newResource] };
      }
      case 'REMOVE_RESOURCE': {
        const { resourceId } = action.payload;
        const newResources = state.resources.filter(r => r.id !== resourceId);
        const newAssignments = state.assignments.filter(a => a.resourceId !== resourceId);
        return { ...state, resources: newResources, assignments: newAssignments };
      }
      case 'UPDATE_RESOURCE': {
        const { id, ...updates } = action.payload;
        const newResources = state.resources.map(res =>
          res.id === id ? { ...res, ...updates } : res
        );
        return { ...state, resources: newResources };
      }
      case 'ADD_CALENDAR': {
        const newCalendar: Calendar = {
            id: `cal-${Date.now()}`,
            name: 'New Calendar',
            workingDays: [1, 2, 3, 4, 5], // Default to Mon-Fri
            exceptions: [],
            nonWorkingDayOverrides: [],
            workingDayOverrides: [],
        };
        return { ...state, calendars: [...state.calendars, newCalendar] };
      }
      case 'REMOVE_CALENDAR': {
        const { calendarId } = action.payload;
        // Don't allow removing the default calendar
        if (calendarId === state.defaultCalendarId) return state;
        
        const newCalendars = state.calendars.filter(c => c.id !== calendarId);
        
        // Reset calendarId for tasks and resources using the removed calendar
        const newTasks = state.tasks.map(t => t.calendarId === calendarId ? { ...t, calendarId: null } : t);
        const newResources = state.resources.map(r => r.calendarId === calendarId ? { ...r, calendarId: null } : r);

        return { ...state, calendars: newCalendars, tasks: newTasks, resources: newResources };
      }
      case 'UPDATE_CALENDAR': {
        const { id, ...updates } = action.payload;
        const newCalendars = state.calendars.map(cal =>
          cal.id === id ? { ...cal, ...updates } : cal
        );
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, state.defaultCalendarId);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks };
      }
      case 'ADD_COLUMN': {
        const { name, type, options, width } = action.payload;
        const newColumn: ColumnSpec = {
            id: `custom-${Date.now()}`,
            name: name,
            width: width || 150,
            type: type,
            options: options,
        };
        const newColumns = [...state.columns, newColumn];
        const newVisibleColumns = [...state.visibleColumns, newColumn.id];
        
        return { ...state, columns: newColumns, visibleColumns: newVisibleColumns, isDirty: true };
      }
      case 'UPDATE_COLUMN': {
        const { id, ...updates } = action.payload;
        const newColumns = state.columns.map(c => c.id === id ? { ...c, ...updates } : c);
        const reScheduledTasks = runScheduler(state.tasks, state.links, newColumns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, columns: newColumns, isDirty: true };
      }
      case 'REMOVE_COLUMN': {
        const { columnId } = action.payload;
        if (!columnId.startsWith('custom-')) return state; 
        const newColumns = state.columns.filter(c => c.id !== columnId);
        const newVisibleColumns = state.visibleColumns.filter(id => id !== columnId);
        const newTasks = state.tasks.map(task => {
            if (task.customAttributes && task.customAttributes[columnId]) {
                const newCustomAttributes = { ...task.customAttributes };
                delete newCustomAttributes[columnId];
                return { ...task, customAttributes: newCustomAttributes };
            }
            return task;
        });

        return { ...state, columns: newColumns, visibleColumns: newVisibleColumns, tasks: newTasks, isDirty: true };
      }
      case 'NEW_PROJECT': {
        const calendarsWithDates: Calendar[] = initialCalendars.map(cal => ({
            id: cal.id,
            name: cal.name,
            workingDays: cal.workingDays,
            exceptions: (cal.exceptions || []).map(ex => ({
                ...ex,
                isActive: ex.isActive !== false, // default to true
                start: new Date(ex.start),
                finish: new Date(ex.finish),
            })),
            nonWorkingDayOverrides: [],
            workingDayOverrides: [],
        }));

        const scheduledTasks = runScheduler([], [], state.columns, calendarsWithDates, calendarsWithDates[0]?.id || null);
        return { 
            ...initialState,
            tasks: scheduledTasks,
            links: [],
            resources: [],
            assignments: [],
            calendars: calendarsWithDates,
            defaultCalendarId: calendarsWithDates[0]?.id || null,
            columns: state.columns,
            visibleColumns: initialVisibleColumns,
            uiDensity: state.uiDensity,
            views: defaultViews,
            filters: [],
            currentViewId: 'default',
            isDirty: false,
            activeCell: null,
            editingCell: null,
            ganttSettings: initialGanttSettings,
         };
      }
      case 'LOAD_PROJECT': {
          try {
            const loadedState = action.payload as ProjectState;
            
            const tasksWithDates: Task[] = (loadedState.tasks || []).map(t => ({
                ...t,
                start: new Date(t.start),
                finish: new Date(t.finish),
                constraintDate: t.constraintDate ? new Date(t.constraintDate) : null,
                deadline: t.deadline ? new Date(t.deadline) : null,
                notes: (t.notes || []).map((note: any) => ({
                    ...note,
                    timestamp: new Date(note.timestamp),
                })),
            }));

            const calendarsWithDates: Calendar[] = (loadedState.calendars || []).map(cal => ({
                ...cal,
                exceptions: (cal.exceptions || []).map(ex => ({
                    ...ex,
                    isActive: ex.isActive !== false,
                    start: new Date(ex.start),
                    finish: new Date(ex.finish),
                })),
                nonWorkingDayOverrides: cal.nonWorkingDayOverrides || [],
                workingDayOverrides: cal.workingDayOverrides || [],
            }));

            const newState: ProjectState = {
                ...initialState,
                ...loadedState,
                tasks: tasksWithDates,
                links: loadedState.links || [],
                resources: loadedState.resources || [],
                assignments: loadedState.assignments || [],
                calendars: calendarsWithDates,
                defaultCalendarId: loadedState.defaultCalendarId || calendarsWithDates[0]?.id || null,
                selectedTaskIds: [],
                historyLog: [],
                uiDensity: loadedState.uiDensity || state.uiDensity,
                columns: loadedState.columns || state.columns,
                visibleColumns: loadedState.visibleColumns || initialVisibleColumns,
                views: loadedState.views || defaultViews,
                filters: loadedState.filters || [],
                currentViewId: loadedState.currentViewId || 'default',
                isDirty: false,
                activeCell: null,
                editingCell: null,
                ganttSettings: loadedState.ganttSettings || initialGanttSettings,
            };
            const scheduledTasks = runScheduler(newState.tasks, newState.links, newState.columns, newState.calendars, newState.defaultCalendarId);
            
            return { ...newState, tasks: scheduledTasks };

          } catch (error) {
              console.error("Failed to load project state:", error);
              return state;
          }
      }
      case 'SET_GROUPING':
        return { ...state, grouping: action.payload, isDirty: true };
      case 'SET_FILTERS':
        return { ...state, filters: action.payload, isDirty: true };
      case 'SET_VIEW': {
        const view = state.views.find(v => v.id === action.payload.viewId);
        if (view) {
            return {
                ...state,
                currentViewId: view.id,
                grouping: view.grouping,
                visibleColumns: view.visibleColumns,
                filters: view.filters || [],
                isDirty: false,
            };
        }
        return state;
      }
      case 'SAVE_VIEW_AS': {
        const { name } = action.payload;
        const newView: View = {
            id: `view-${Date.now()}`,
            name,
            grouping: state.grouping,
            visibleColumns: state.visibleColumns,
            filters: state.filters,
        };
        const newViews = [...state.views, newView];
        return { ...state, views: newViews, currentViewId: newView.id, isDirty: false };
      }
      case 'UPDATE_CURRENT_VIEW': {
        if (!state.currentViewId) return state;
        
        const newViews = state.views.map(v => 
            v.id === state.currentViewId 
            ? { ...v, grouping: state.grouping, visibleColumns: state.visibleColumns, filters: state.filters }
            : v
        );
        return { ...state, views: newViews, isDirty: false };
      }
      case 'DELETE_VIEW': {
        const { viewId } = action.payload;
        if (viewId === 'default') return state;
        
        const newViews = state.views.filter(v => v.id !== viewId);
        let newCurrentViewId = state.currentViewId;
        let newGrouping = state.grouping;
        let newVisibleColumns = state.visibleColumns;
        let newFilters = state.filters;

        if (state.currentViewId === viewId) {
            newCurrentViewId = 'default';
            const defaultView = newViews.find(v => v.id === 'default') ?? defaultViews[0];
            newGrouping = defaultView.grouping;
            newVisibleColumns = defaultView.visibleColumns;
            newFilters = defaultView.filters || [];
        }
        
        return { 
            ...state, 
            views: newViews, 
            currentViewId: newCurrentViewId,
            grouping: newGrouping,
            visibleColumns: newVisibleColumns,
            filters: newFilters,
            isDirty: false
        };
      }
      case 'TOGGLE_MULTI_SELECT_MODE': {
        return { ...state, multiSelectMode: !state.multiSelectMode };
      }
      case 'ADD_NOTE_TO_TASK': {
        const { taskId, content } = action.payload;
        const newTasks = state.tasks.map(task => {
            if (task.id === taskId) {
                const newNote: Note = {
                    id: `note-${Date.now()}`,
                    author: 'User', // Hardcoded for now
                    content,
                    timestamp: new Date(),
                };
                const notes = [newNote, ...(task.notes || [])];
                return { ...task, notes };
            }
            return task;
        });
        return { ...state, tasks: newTasks };
      }
       case 'ADD_TASKS_FROM_PASTE': {
        const { data } = action.payload;
        const rows = data.split('\n').filter(row => row.trim() !== '');
        if (rows.length === 0) return state;

        const visibleColumns = state.columns.filter(c => state.visibleColumns.includes(c.id));

        const newTasks: Task[] = [];
        const defaultCalendar = state.calendars.find(c => c.id === state.defaultCalendarId) || state.calendars[0];
        
        rows.forEach((row, rowIndex) => {
            if (!row.trim()) return;
            
            const values = row.split('\t');
            const newTask: Partial<Task> & { start: Date } = {
                id: `T-paste-${Date.now()}-${rowIndex}`,
                percentComplete: 0,
                cost: 0,
                level: 0,
                start: new Date(), // default start date
                duration: 1, // default duration
            };

            visibleColumns.forEach((col, colIndex) => {
                const value = values[colIndex]?.trim();
                if (value === undefined || value === '') return;

                switch(col.id) {
                    case 'name':
                        newTask.name = value;
                        break;
                    case 'duration':
                        const duration = parseInt(value, 10);
                        if (!isNaN(duration) && duration > 0) newTask.duration = duration;
                        break;
                    case 'start':
                        const startDate = new Date(value);
                        if (!isNaN(startDate.getTime())) newTask.start = startDate;
                        break;
                    case 'percentComplete':
                        const percent = parseInt(value.replace('%', ''), 10);
                        if (!isNaN(percent)) newTask.percentComplete = Math.max(0, Math.min(100, percent));
                        break;
                    case 'cost':
                        const cost = parseFloat(value.replace(/[^0-9.,$]+/g, "").replace(',', ''));
                        if (!isNaN(cost)) newTask.cost = cost;
                        break;
                    // Note: Pasting relationships (predecessors/successors) is not supported for simplicity.
                }
            });
            
            if (!newTask.name) {
                newTask.name = `Pasted Task ${rowIndex + 1}`;
            }
            
            if (defaultCalendar) {
                newTask.finish = calendarService.addWorkingDays(newTask.start, newTask.duration! > 0 ? newTask.duration! - 1 : 0, defaultCalendar);
            } else {
                newTask.finish = new Date(newTask.start);
            }
            
            newTasks.push(newTask as Task);
        });
        
        if (newTasks.length === 0) return state;
        
        let combinedTasks = [...state.tasks, ...newTasks];
        let scheduledTasks = runScheduler(combinedTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);

        return { ...state, tasks: scheduledTasks, selectedTaskIds: newTasks.map(t => t.id) };
      }
      case 'SET_ACTIVE_CELL': {
        if (action.payload?.taskId === state.activeCell?.taskId && action.payload?.columnId === state.activeCell?.columnId) {
            return { ...state, activeCell: action.payload, editingCell: action.payload };
        }
        return { ...state, activeCell: action.payload, editingCell: null };
      }
      case 'START_EDITING_CELL': {
        return { ...state, activeCell: action.payload, editingCell: action.payload };
      }
      case 'STOP_EDITING_CELL': {
        return { ...state, editingCell: null };
      }
      case 'UPDATE_GANTT_SETTINGS': {
        return { ...state, ganttSettings: action.payload, isDirty: true };
      }
      case 'EXPAND_ALL':
      case 'COLLAPSE_ALL': {
        const shouldCollapse = action.type === 'COLLAPSE_ALL';
        const { tasks, selectedTaskIds } = state;
        
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const tasksToUpdate = new Set<string>();

        // If a selection exists, find all summary tasks within the selection and all their descendants.
        if (selectedTaskIds.length > 0) {
            const queue: string[] = [...selectedTaskIds];
            const visited = new Set<string>();

            while(queue.length > 0) {
                const currentId = queue.shift()!;
                if(visited.has(currentId)) continue;
                visited.add(currentId);

                const task = taskMap.get(currentId);
                if (task && task.isSummary) {
                    tasksToUpdate.add(currentId);
                }

                // Add children to the queue to process descendants
                tasks.forEach(t => {
                    if (t.parentId === currentId) {
                        queue.push(t.id);
                    }
                });
            }
        } else {
            // No selection, so apply to all summary tasks in the project.
            tasks.forEach(task => {
                if (task.isSummary) {
                    tasksToUpdate.add(task.id);
                }
            });
        }
        
        if (tasksToUpdate.size === 0) return state;

        const newTasks = tasks.map(task => {
          if (tasksToUpdate.has(task.id)) {
            return { ...task, isCollapsed: shouldCollapse };
          }
          return task;
        });

        return { ...state, tasks: newTasks };
      }
      default:
        return state;
    }
  })();
  
  if (action.type === 'INIT_STATE') {
      return newState;
  }
  
  if (state === newState) {
    return state;
  }

  const nonLoggableActions: Action['type'][] = [
    'SCHEDULE_PROJECT',
    'SELECT_TASK',
    'MOVE_SELECTION',
    'TOGGLE_MULTI_SELECT_MODE',
    'SET_ACTIVE_CELL',
    'START_EDITING_CELL',
    'STOP_EDITING_CELL',
    'UNDO',
    'REDO'
  ];

  if (nonLoggableActions.includes(action.type)) {
      return { ...newState, isDirty: true };
  }
  
  // Create a serializable and minimal action object for the log
  const loggedAction = { type: action.type, payload: (action as any).payload };

  return { ...newState, isDirty: true, historyLog: [...(newState.historyLog || []), { action: loggedAction, timestamp: new Date() }] };
}

type UndoableState = {
    past: ProjectState[];
    present: ProjectState;
    future: ProjectState[];
};

const nonUndoableActions: Action['type'][] = [
    'INIT_STATE', 
    'SELECT_TASK', 
    'MOVE_SELECTION', 
    'TOGGLE_MULTI_SELECT_MODE',
    'SET_ACTIVE_CELL',
    'START_EDITING_CELL',
    'STOP_EDITING_CELL',
    'UNDO',
    'REDO'
];

function undoableReducer(state: UndoableState, action: Action): UndoableState {
    const { past, present, future } = state;

    switch (action.type) {
        case 'UNDO': {
            if (past.length === 0) return state;
            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);
            return {
                past: newPast,
                present: previous,
                future: [present, ...future]
            };
        }
        case 'REDO': {
            if (future.length === 0) return state;
            const next = future[0];
            const newFuture = future.slice(1);
            return {
                past: [...past, present],
                present: next,
                future: newFuture
            };
        }
        case 'LOAD_PROJECT':
        case 'NEW_PROJECT': {
             const newPresent = projectReducer(present, action);
             return {
                 past: [],
                 present: newPresent,
                 future: []
             };
        }
        default: {
            const newPresent = projectReducer(present, action);
            if (present === newPresent) {
                return state;
            }

            if (nonUndoableActions.includes(action.type)) {
                return { ...state, present: newPresent };
            }
            
            return {
                past: [...past, present],
                present: newPresent,
                future: []
            };
        }
    }
}


const initialStateWithHistory: UndoableState = {
    past: [],
    present: initialState,
    future: [],
};

export function useProject() {
  const [state, dispatch] = useReducer(undoableReducer, initialStateWithHistory);
  const [isLoaded, setIsLoaded] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

   useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentState = stateRef.current.present;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }
      
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            dispatch({ type: 'UNDO' });
            return;
        }
        if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
            event.preventDefault();
            dispatch({ type: 'REDO' });
            return;
        }
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
      } else if (event.key === 'Delete') {
        event.preventDefault();
        dispatch({ type: 'REMOVE_TASK' });
      } else if (event.key === 'Insert') {
        event.preventDefault();
        dispatch({ type: 'ADD_TASK' });
      }

      if (currentState.activeCell && !currentState.editingCell) {
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            dispatch({
                type: 'START_EDITING_CELL',
                payload: { ...currentState.activeCell, initialValue: event.key }
            });
        } else if (event.key === 'Backspace') {
            event.preventDefault();
            dispatch({
                type: 'START_EDITING_CELL',
                payload: { ...currentState.activeCell, initialValue: '' }
            });
        }
      }
    };

    const getCellValue = (task: Task, columnId: string, state: ProjectState): string => {
        const { links, resources, assignments, columns } = state;
        const idToWbsMap = new Map(state.tasks.map(t => [t.id, t.wbs || '']));
        const resourceMap = new Map(resources.map(r => [r.id, r.name]));

        const col = columns.find(c => c.id === columnId);
        if (!col) return '';
        
        switch (col.id) {
            case 'wbs': return task.wbs || '';
            case 'name': return task.name;
            case 'duration': return String(task.duration);
            case 'start': return format(task.start, 'MM/dd/yyyy');
            case 'finish': return format(task.finish, 'MM/dd/yyyy');
            case 'cost': return String(task.cost || 0);
            case 'percentComplete': return `${task.percentComplete}%`;
            case 'resourceNames': {
                const taskAssignments = assignments.filter(a => a.taskId === task.id);
                return taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
            }
            case 'predecessors': {
                const predecessorLinks = links.filter(l => l.target === task.id);
                return predecessorLinks.map(l => {
                    const sourceWbs = idToWbsMap.get(l.source);
                    if (!sourceWbs) return '';
                    let lagString = '';
                    if (l.lag > 0) lagString = `+${l.lag}d`;
                    if (l.lag < 0) lagString = `${l.lag}d`;
                    return `${sourceWbs}${l.type}${lagString}`;
                }).join(', ');
            }
            case 'successors': {
                const successorLinks = links.filter(l => l.source === task.id);
                return successorLinks.map(l => {
                    const targetWbs = idToWbsMap.get(l.target);
                    if (!targetWbs) return '';
                    let lagString = '';
                    if (l.lag > 0) lagString = `+${l.lag}d`;
                    if (l.lag < 0) lagString = `${l.lag}d`;
                    return `${targetWbs}${l.type}${lagString}`;
                }).join(', ');
            }
            case 'constraintType': return task.constraintType || '';
            case 'constraintDate': return task.constraintDate ? format(task.constraintDate, 'MM/dd/yyyy') : '';
            // No default case needed, custom attributes handled below
        }
        
        if (col.id.startsWith('custom-')) {
            return String(task.customAttributes?.[col.id] || '');
        }

        return '';
    };

    const handleCopy = (e: ClipboardEvent) => {
        const currentState = stateRef.current.present;
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        // Single cell copy
        if (currentState.activeCell) {
            const { taskId, columnId } = currentState.activeCell;
            const task = currentState.tasks.find(t => t.id === taskId);
            if (task) {
                const cellValue = getCellValue(task, columnId, currentState);
                e.clipboardData?.setData('text/plain', cellValue);
                e.preventDefault();
                return;
            }
        }
        
        // Row copy (fallback)
        if (currentState.selectedTaskIds.length === 0) return;

        e.preventDefault();

        const columnsToCopy = currentState.columns.filter(c => currentState.visibleColumns.includes(c.id));
        const header = columnsToCopy.map(c => c.name).join('\t');

        const selectedTasks = currentState.tasks.filter(t => currentState.selectedTaskIds.includes(t.id));

        const taskRows = selectedTasks.map(task => {
            return columnsToCopy.map(col => getCellValue(task, col.id, currentState)).join('\t');
        });

        const data = [header, ...taskRows].join('\n');
        e.clipboardData?.setData('text/plain', data);
    };

    const handlePaste = (e: ClipboardEvent) => {
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        
        const data = e.clipboardData?.getData('text/plain');
        if (!data) return;

        const currentState = stateRef.current.present;
        const hasMultipleLines = data.includes('\n');
        
        // If pasting multiple lines, always treat it as adding new tasks.
        if (hasMultipleLines) {
            e.preventDefault();
            dispatch({ type: 'ADD_TASKS_FROM_PASTE', payload: { data }});
            return;
        }

        // Single line paste logic for an active cell
        if (currentState.activeCell) {
            e.preventDefault();
            const { taskId, columnId } = currentState.activeCell;
            const task = currentState.tasks.find(t => t.id === taskId);
            if (!task || task.isSummary) return;

            const value = data.trim();

            switch (columnId) {
                case 'name':
                    dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, name: value } });
                    break;
                case 'duration': {
                    const duration = parseInt(value, 10);
                    if (!isNaN(duration) && duration > 0) {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, duration } });
                    }
                    break;
                }
                case 'start':
                case 'finish':
                case 'constraintDate':
                case 'deadline': {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, [columnId]: date } });
                    }
                    break;
                }
                case 'cost': {
                    const cost = parseFloat(value.replace(/[^0-9.]/g, ''));
                    if (!isNaN(cost)) {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, cost } });
                    }
                    break;
                }
                case 'percentComplete': {
                    const percent = parseInt(value.replace('%', ''), 10);
                    if (!isNaN(percent)) {
                        dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, percentComplete: Math.max(0, Math.min(100, percent)) } });
                    }
                    break;
                }
                case 'predecessors':
                case 'successors':
                    dispatch({ type: 'UPDATE_RELATIONSHIPS', payload: { taskId, field: columnId as 'predecessors' | 'successors', value } });
                    break;
                default:
                    if (columnId.startsWith('custom-')) {
                        const column = currentState.columns.find(c => c.id === columnId);
                        if (column) {
                             let valueToSave: string | number = value;
                            if (column.type === 'number') {
                                const num = parseFloat(value);
                                valueToSave = isNaN(num) ? 0 : num;
                            }
                             dispatch({
                                type: 'UPDATE_TASK',
                                payload: {
                                    id: taskId,
                                    customAttributes: { ...(task.customAttributes || {}), [columnId]: valueToSave }
                                }
                            });
                        }
                    }
                    break;
            }
            return;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  useEffect(() => {
    const tasksWithDates: Task[] = initialTasks.map(t => ({
      ...t,
      isCollapsed: !!t.isCollapsed,
      start: new Date(t.start),
      finish: new Date(t.finish),
      constraintDate: t.constraintDate ? new Date(t.constraintDate) : undefined,
      deadline: t.deadline ? new Date(t.deadline) : undefined,
      cost: t.cost || 0,
      notes: (t.notes || []).map((note: any) => ({
          ...note,
          timestamp: new Date(note.timestamp)
      }))
    } as Task));

    const calendarsWithDates: Calendar[] = initialCalendars.map(cal => ({
        id: cal.id,
        name: cal.name,
        workingDays: cal.workingDays,
        exceptions: (cal.exceptions || []).map(ex => ({
            ...ex,
            isActive: ex.isActive !== false,
            start: new Date(ex.start),
            finish: new Date(ex.finish),
        })),
        nonWorkingDayOverrides: [],
        workingDayOverrides: [],
    }));
    
    const defaultCalendar = calendarsWithDates.find(c => c.id === initialCalendars[0].id) || calendarsWithDates[0];
    const hierarchicalTasks = updateHierarchyAndSort(tasksWithDates);
    const scheduledTasks = calculateSchedule(hierarchicalTasks, initialLinks, initialColumns, defaultCalendar);

    dispatch({ type: 'INIT_STATE', payload: { ...initialState, tasks: scheduledTasks, links: initialLinks, resources: initialResources, assignments: initialAssignments, calendars: calendarsWithDates, defaultCalendarId: calendarsWithDates[0]?.id || null, columns: initialColumns, visibleColumns: initialVisibleColumns, views: defaultViews, currentViewId: 'default' } });
    setIsLoaded(true);
  }, []);

  return { 
    state: state.present, 
    dispatch, 
    isLoaded,
    history: state.past,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
