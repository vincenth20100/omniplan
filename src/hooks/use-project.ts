'use client';

import { useReducer, useEffect, useState } from 'react';
import type { ProjectState, Task, Link, ColumnSpec, UiDensity, LinkType, Resource, Assignment, Calendar, Exception, View } from '@/lib/types';
import { initialTasks, initialLinks, initialResources, initialAssignments, initialCalendars } from '@/lib/mock-data';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';

const ALL_COLUMNS: (Omit<ColumnSpec, 'width'> & { defaultWidth: number })[] = [
    { id: 'wbs', name: 'WBS', defaultWidth: 50, type: 'text' },
    { id: 'name', name: 'Task Name', defaultWidth: 250, type: 'text' },
    { id: 'resourceNames', name: 'Resource Names', defaultWidth: 150, type: 'text' },
    { id: 'duration', name: 'Duration', defaultWidth: 80, type: 'number' },
    { id: 'start', name: 'Start', defaultWidth: 110, type: 'text' }, // It's a date, but handled as custom cell. 'text' is fine for type.
    { id: 'finish', name: 'Finish', defaultWidth: 110, type: 'text' },
    { id: 'cost', name: 'Cost', defaultWidth: 100, type: 'number' },
    { id: 'predecessors', name: 'Predecessors', defaultWidth: 120, type: 'text' },
    { id: 'successors', name: 'Successors', defaultWidth: 120, type: 'text' },
    { id: 'percentComplete', name: '% Complete', defaultWidth: 80, type: 'number' },
    { id: 'constraintType', name: 'Constraint Type', defaultWidth: 110, type: 'selection', options: ['Start No Earlier Than', 'Must Start On'] },
    { id: 'constraintDate', name: 'Constraint Date', defaultWidth: 110, type: 'text' },
];

const initialColumns: ColumnSpec[] = ALL_COLUMNS.map(c => ({ id: c.id, name: c.name, width: c.defaultWidth, type: c.type, options: c.options }));

const initialVisibleColumns = ['wbs', 'name', 'resourceNames', 'duration', 'start', 'finish', 'cost', 'predecessors', 'successors'];

const defaultViews: View[] = [
    { id: 'default', name: 'Default View', grouping: [], visibleColumns: initialVisibleColumns }
];

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
  views: defaultViews,
  currentViewId: 'default',
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
  | { type: 'SET_VIEW', payload: { viewId: string } }
  | { type: 'SAVE_VIEW_AS', payload: { name: string } }
  | { type: 'UPDATE_CURRENT_VIEW' }
  | { type: 'DELETE_VIEW', payload: { viewId: string } };


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
        children.sort((a, b) => (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0));
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
  const runScheduler = (tasks: Task[], links: Link[], columns: ColumnSpec[]): Task[] => {
      return calculateSchedule(tasks, links, columns);
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
        const scheduledTasks = runScheduler(state.tasks, state.links, state.columns);
        return { ...state, tasks: scheduledTasks };
      }

      case 'UPDATE_TASK': {
        const { id, ...updates } = action.payload;
        let newTasks = state.tasks.map(task =>
          task.id === id ? { ...task, ...updates } : task
        );
        
        const updatedTask = newTasks.find(t => t.id === id);
        if (updatedTask && !updatedTask.isSummary) {
          // If start date is changed (e.g., by moving), update finish date to preserve duration
          if (updates.start !== undefined && updates.duration === undefined && updates.finish === undefined) {
            updatedTask.finish = calendarService.addWorkingDays(updatedTask.start, updatedTask.duration > 0 ? updatedTask.duration - 1 : 0);
          }
          // If duration is explicitly changed, update finish date
          else if (updates.duration !== undefined) {
            updatedTask.finish = calendarService.addWorkingDays(updatedTask.start, updatedTask.duration > 0 ? updatedTask.duration - 1 : 0);
          } 
          // If finish date is changed, update duration
          else if (updates.finish !== undefined) {
            if (updatedTask.start > updatedTask.finish) {
              updatedTask.start = updatedTask.finish; // Prevent finish from being before start
            }
            updatedTask.duration = calendarService.getWorkingDaysDuration(updatedTask.start, updatedTask.finish);
          }
        }
        
        const reScheduledTasks = runScheduler(newTasks, state.links, state.columns);
        return { ...state, tasks: reScheduledTasks };
      }
      case 'UPDATE_LINK': {
        const { id, ...updates } = action.payload;
        const newLinks = state.links.map(link =>
          link.id === id ? { ...link, ...updates } : link
        );
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns);
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

        if (ctrlKey) {
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
        const reScheduledTasks = runScheduler(state.tasks, combinedLinks, state.columns);
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
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns);
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
        return { ...state, visibleColumns: action.payload, currentViewId: null };
      }
       case 'RESIZE_COLUMN': {
        const { columnId, width } = action.payload;
        const newColumns = state.columns.map(c =>
          c.id === columnId ? { ...c, width } : c
        );
        return { ...state, columns: newColumns, currentViewId: null };
      }
      case 'REORDER_COLUMNS': {
        const { sourceId, targetId } = action.payload;
        const columns = [...state.columns];
        const sourceIndex = columns.findIndex(c => c.id === sourceId);
        const targetIndex = columns.findIndex(c => c.id === targetId);
    
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return state;
    
        const [removed] = columns.splice(sourceIndex, 1);
        columns.splice(targetIndex, 0, removed);
        
        return { ...state, columns, currentViewId: null };
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

        if (!newParent.isSummary) {
          newParent.isSummary = true;
        }

        for (const taskId of state.selectedTaskIds) {
            const taskToUpdate = taskMap.get(taskId);
            if (taskToUpdate) {
                taskToUpdate.parentId = newParent.id;
            }
        }

        const newTasks = updateHierarchyAndSort(Array.from(taskMap.values()));
        const reScheduledTasks = runScheduler(newTasks, state.links, state.columns);
        return { ...state, tasks: reScheduledTasks };
      }
      case 'OUTDENT_TASK': {
        if (state.selectedTaskIds.length === 0) return state;

        const tasksCopy = state.tasks.map(t => ({...t}));
        const taskMap = new Map(tasksCopy.map(t => [t.id, t]));
        const oldParentIds = new Set<string>();

        // Update parentIds for all selected tasks
        state.selectedTaskIds.forEach(id => {
            const taskToUpdate = taskMap.get(id);
            if (taskToUpdate?.parentId) {
                const currentParent = taskMap.get(taskToUpdate.parentId);
                if (currentParent) {
                    oldParentIds.add(currentParent.id);
                    taskToUpdate.parentId = currentParent.parentId ?? null;
                }
            }
        });
        
        // After parent changes, check if old parents still have children. If not, demote them.
        oldParentIds.forEach(parentId => {
            const hasChildren = Array.from(taskMap.values()).some(t => t.parentId === parentId);
            if (!hasChildren) {
                const parentTask = taskMap.get(parentId);
                if (parentTask) {
                    parentTask.isSummary = false;
                }
            }
        });

        const newTasks = updateHierarchyAndSort(Array.from(taskMap.values()));
        const reScheduledTasks = runScheduler(newTasks, state.links, state.columns);
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

        const hierarchicalTasks = updateHierarchyAndSort(newTasks);
        const reScheduledTasks = runScheduler(hierarchicalTasks, state.links, state.columns);
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
        
        const hierarchicalTasks = updateHierarchyAndSort(newTasks);
        const reScheduledTasks = runScheduler(hierarchicalTasks, newLinks, state.columns);
        
        return { ...state, tasks: reScheduledTasks, links: newLinks, selectedTaskIds: [] };
      }
      case 'REMOVE_LINK': {
        const { linkId } = action.payload;
        const newLinks = state.links.filter(l => l.id !== linkId);
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns);
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

        const hierarchicalTasks = updateHierarchyAndSort(remainingTasks);
        const reScheduledTasks = runScheduler(hierarchicalTasks, state.links, state.columns);
        
        return { ...state, tasks: reScheduledTasks };
      }
      case 'NEST_TASKS': {
        const { sourceIds, parentId } = action.payload;
        if (sourceIds.includes(parentId)) return state;

        const tasksCopy = state.tasks.map(t => ({...t}));
        const taskMap = new Map(tasksCopy.map(t => [t.id, t]));

        const parentTask = taskMap.get(parentId);
        if (!parentTask) return state;

        if (!parentTask.isSummary) {
          parentTask.isSummary = true;
        }
        
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
        
        const hierarchicalTasks = updateHierarchyAndSort(remainingTasks);
        const reScheduledTasks = runScheduler(hierarchicalTasks, state.links, state.columns);
        
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
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns);
        
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
        return { ...state, calendars: newCalendars };
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
        
        return { ...state, columns: newColumns, visibleColumns: newVisibleColumns, currentViewId: null };
      }
      case 'UPDATE_COLUMN': {
        const { id, ...updates } = action.payload;
        const newColumns = state.columns.map(c => c.id === id ? { ...c, ...updates } : c);
        const reScheduledTasks = runScheduler(state.tasks, state.links, newColumns);
        return { ...state, tasks: reScheduledTasks, columns: newColumns, currentViewId: null };
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

        return { ...state, columns: newColumns, visibleColumns: newVisibleColumns, tasks: newTasks, currentViewId: null };
      }
      case 'NEW_PROJECT': {
        const calendarsWithDates: Calendar[] = initialCalendars.map(cal => ({
            id: cal.id,
            name: cal.name,
            workingDays: cal.workingDays,
            exceptions: (cal.exceptions || []).map(ex => ({
                ...ex,
                start: new Date(ex.start),
                finish: new Date(ex.finish),
            }))
        }));

        const scheduledTasks = runScheduler([], [], state.columns);
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
            currentViewId: 'default',
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
            }));

            const calendarsWithDates: Calendar[] = (loadedState.calendars || []).map(cal => ({
                ...cal,
                exceptions: (cal.exceptions || []).map(ex => ({
                    ...ex,
                    start: new Date(ex.start),
                    finish: new Date(ex.finish),
                }))
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
                currentViewId: loadedState.currentViewId || 'default',
            };
            const scheduledTasks = runScheduler(newState.tasks, newState.links, newState.columns);
            
            return { ...newState, tasks: scheduledTasks };

          } catch (error) {
              console.error("Failed to load project state:", error);
              return state;
          }
      }
      case 'SET_GROUPING':
        return { ...state, grouping: action.payload, currentViewId: null };
      case 'SET_VIEW': {
        const view = state.views.find(v => v.id === action.payload.viewId);
        if (view) {
            return {
                ...state,
                currentViewId: view.id,
                grouping: view.grouping,
                visibleColumns: view.visibleColumns,
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
        };
        const newViews = [...state.views, newView];
        return { ...state, views: newViews, currentViewId: newView.id };
      }
      case 'UPDATE_CURRENT_VIEW': {
        if (!state.currentViewId) return state;
        
        const newViews = state.views.map(v => 
            v.id === state.currentViewId 
            ? { ...v, grouping: state.grouping, visibleColumns: state.visibleColumns }
            : v
        );
        return { ...state, views: newViews };
      }
      case 'DELETE_VIEW': {
        const { viewId } = action.payload;
        if (viewId === 'default') return state;
        
        const newViews = state.views.filter(v => v.id !== viewId);
        let newCurrentViewId = state.currentViewId;
        let newGrouping = state.grouping;
        let newVisibleColumns = state.visibleColumns;

        if (state.currentViewId === viewId) {
            newCurrentViewId = 'default';
            const defaultView = newViews.find(v => v.id === 'default')!;
            newGrouping = defaultView.grouping;
            newVisibleColumns = defaultView.visibleColumns;
        }
        
        return { 
            ...state, 
            views: newViews, 
            currentViewId: newCurrentViewId,
            grouping: newGrouping,
            visibleColumns: newVisibleColumns
        };
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
      } else if (event.key === 'Delete') {
        event.preventDefault();
        dispatch({ type: 'REMOVE_TASK' });
      } else if (event.key === 'Insert') {
        event.preventDefault();
        dispatch({ type: 'ADD_TASK' });
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
      cost: t.cost || 0,
    }));

    const calendarsWithDates: Calendar[] = initialCalendars.map(cal => ({
        id: cal.id,
        name: cal.name,
        workingDays: cal.workingDays,
        exceptions: (cal.exceptions || []).map(ex => ({
            ...ex,
            start: new Date(ex.start),
            finish: new Date(ex.finish),
        }))
    }));
    
    const scheduledTasks = calculateSchedule(tasksWithDates, initialLinks, initialColumns);
    dispatch({ type: 'INIT_STATE', payload: { ...initialState, tasks: scheduledTasks, links: initialLinks, resources: initialResources, assignments: initialAssignments, calendars: calendarsWithDates, defaultCalendarId: calendarsWithDates[0]?.id || null, columns: initialColumns, visibleColumns: initialVisibleColumns, views: defaultViews, currentViewId: 'default' } });
    setIsLoaded(true);
  }, []);

  return { state, dispatch, isLoaded };
}
