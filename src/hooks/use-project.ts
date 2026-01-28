'use client';

import { useReducer, useEffect, useState, useMemo, useCallback } from 'react';
import type { ProjectState, Task, Link, ColumnSpec, UiDensity, LinkType, Resource, Assignment, Calendar, Exception, View, Note, Filter, GanttSettings, HistoryEntry, Representation, Project, ProjectMember } from '@/lib/types';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';
import { format } from 'date-fns';
import { parseDuration, formatDuration } from '@/lib/duration';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { User } from 'firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { ALL_COLUMNS, initialColumns, initialVisibleColumns } from '@/lib/columns';


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
  renderSplitTasks: false,
  dateFormat: 'MMM d, yyyy',
  theme: 'dark',
  customStyles: {}
};

const defaultAppSettings = {
    id: 'app_settings',
    columns: initialColumns,
    uiDensity: 'compact' as UiDensity,
    currentViewId: 'default',
    ganttSettings: initialGanttSettings,
    visibleColumns: initialVisibleColumns,
    grouping: [],
    filters: [],
};

const initialState: ProjectState = {
  tasks: [],
  links: [],
  resources: [],
  assignments: [],
  zones: [],
  calendars: [],
  defaultCalendarId: null,
  selectedTaskIds: [],
  selectionAnchor: null,
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
  notifications: [],
  currentRepresentation: 'gantt',
};

type Action =
  | { type: 'SET_PROJECT_DATA', payload: { tasks: Task[], links: Link[], resources: Resource[], assignments: Assignment[], calendars: Calendar[] } }
  | { type: 'SET_PERSISTED_STATE', payload: { views: View[], settings: typeof defaultAppSettings | null, member: ProjectMember | null } }
  | { type: 'SCHEDULE_PROJECT' }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'UPDATE_LINK'; payload: Partial<Link> & { id: string } }
  | { type: 'SELECT_TASK'; payload: { taskId: string | null, ctrlKey?: boolean, shiftKey?: boolean } }
  | { type: 'LINK_TASKS' }
  | { type: 'ADD_LINK'; payload: { source: string, target: string, type: LinkType, lag: number } }
  | { type: 'SET_CONFLICTS'; payload: { taskId: string, conflictDescription: string }[] }
  | { type: 'TOGGLE_TASK_COLLAPSE'; payload: { taskId: string } }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'EXPAND_ALL' }
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
  | { type: 'ADD_TASKS_FROM_PASTE', payload: { data: string, activeCell: { taskId: string, columnId: string } | null } }
  | { type: 'SET_ACTIVE_CELL'; payload: { taskId: string; columnId: string } | null }
  | { type: 'START_EDITING_CELL', payload: { taskId: string, columnId: string, initialValue?: string } }
  | { type: 'STOP_EDITING_CELL' }
  | { type: 'UPDATE_GANTT_SETTINGS', payload: GanttSettings }
  | { type: '_APPLY_STATE_CHANGE', payload: { newState: ProjectState, originalAction: Action } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'JUMP_TO_HISTORY', payload: { index: number } }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'FIND_AND_REPLACE', payload: { find: string; replace: string } }
  | { type: 'SET_REPRESENTATION', payload: Representation };

/**
 * Creates a "clean" task object suitable for Firestore,
 * removing calculated fields and converting `undefined` to `null`.
 */
const toFirestoreTask = (task: Task) => {
  const { isCritical, totalFloat, lateStart, lateFinish, ...rest } = task;

  const cleanTask: Record<string, any> = { ...rest };

  // Ensure no undefined values are sent
  for (const key in cleanTask) {
    if (cleanTask[key] === undefined) {
      cleanTask[key] = null;
    }
  }
  
  if (cleanTask.notes) {
      cleanTask.notes = cleanTask.notes.map((n: Note) => ({...n, timestamp: n.timestamp}));
  }
  
  return cleanTask;
};

function updateHierarchyAndSort(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map(t => ({ ...t })).map(t => [t.id, t]));
    
    for (const task of taskMap.values()) {
        if (task.parentId && !taskMap.has(task.parentId)) {
            task.parentId = null;
        }
    }

    const childrenMap = new Map<string, string[]>();
    for (const task of taskMap.values()) {
        if (task.parentId) {
            if (!childrenMap.has(task.parentId)) childrenMap.set(task.parentId, []);
            childrenMap.get(task.parentId)!.push(task.id);
        }
    }
    
    for (const task of taskMap.values()) {
        task.isSummary = childrenMap.has(task.id) && childrenMap.get(task.id)!.length > 0;
    }

    const rootTasks = Array.from(taskMap.values()).filter(t => !t.parentId);

    const originalIndices = new Map(tasks.map((t, i) => [t.id, i]));
    rootTasks.sort((a, b) => (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0));
    
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

function getVisibleTasks(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    return tasks.filter(task => {
        if (!task.parentId) return true;
        let p: Task | undefined = task.parentId ? taskMap.get(task.parentId) : undefined;
        while(p) {
            if (p.isCollapsed) return false;
            p = p.parentId ? taskMap.get(p.parentId) : undefined;
        }
        return true;
    });
};

function expandSummaryLinks(links: Link[], tasks: Task[]): Link[] {
    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));

    const childrenMap = new Map<string, string[]>();
    tasks.forEach(t => {
        if (t.parentId) {
            if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
            childrenMap.get(t.parentId)!.push(t.id);
        }
    });

    const expandedLinks: Link[] = [];
    links.forEach(link => {
        const sourceTask = taskMap.get(link.source);
        const targetTask = taskMap.get(link.target);

        if (!sourceTask || !targetTask) return;

        let effectiveSources = [link.source];
        if (sourceTask.isSummary) {
            const childrenIds = childrenMap.get(sourceTask.id) || [];
            const exitTasks = childrenIds.filter(childId => 
                !links.some(l => l.source === childId && childrenIds.includes(l.target))
            );
            effectiveSources = exitTasks.length > 0 ? exitTasks : childrenIds;
        }

        let effectiveTargets = [link.target];
        if (targetTask.isSummary) {
            const childrenIds = childrenMap.get(targetTask.id) || [];
            const entryTasks = childrenIds.filter(childId => 
                !links.some(l => l.target === childId && childrenIds.includes(l.source))
            );
            effectiveTargets = entryTasks.length > 0 ? entryTasks : childrenIds;
        }
        
        effectiveSources.forEach(sId => {
            effectiveTargets.forEach(tId => {
                const sTask = taskMap.get(sId);
                const tTask = taskMap.get(tId);
                if (sTask && !sTask.isSummary && tTask && !tTask.isSummary) {
                    expandedLinks.push({ ...link, source: sId, target: tId });
                }
            });
        });
    });
    return expandedLinks;
}

function isCycle(sourceId: string, targetId: string, links: Link[], tasks: Task[]): boolean {
    if (sourceId === targetId) return true;

    // 1. Get the expanded graph of EXISTING links
    const expandedLinks = expandSummaryLinks(links, tasks);
    const successorsMap = new Map<string, string[]>();
    expandedLinks.forEach(link => {
        if (!successorsMap.has(link.source)) successorsMap.set(link.source, []);
        successorsMap.get(link.source)!.push(link.target);
    });

    // Helper to check for a path from startNode to endNode
    const pathExists = (startNode: string, endNode: string) => {
        const queue: string[] = [startNode];
        const visited = new Set<string>([startNode]);
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const successors = successorsMap.get(currentId) || [];
            for (const successorId of successors) {
                if (successorId === endNode) return true;
                if (!visited.has(successorId)) {
                    visited.add(successorId);
                    queue.push(successorId);
                }
            }
        }
        return false;
    };
    
    // 2. Get the effective sources and targets of the PROPOSED link
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const childrenMap = new Map<string, string[]>();
    tasks.forEach(t => {
        if (t.parentId) {
            if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
            childrenMap.get(t.parentId)!.push(t.id);
        }
    });

    const sourceTask = taskMap.get(sourceId);
    const targetTask = taskMap.get(targetId);
    if (!sourceTask || !targetTask) return false;

    let effectiveSources = sourceTask.isSummary ? (childrenMap.get(sourceId) || []) : [sourceId];
    let effectiveTargets = targetTask.isSummary ? (childrenMap.get(targetId) || []) : [targetId];

    // 3. Check for a cycle for each potential new effective link
    for (const effS of effectiveSources) {
        for (const effT of effectiveTargets) {
            if (effT === effS) return true;
            if (pathExists(effT, effS)) {
                return true;
            }
        }
    }

    return false;
}

function projectReducer(state: ProjectState, action: Action): ProjectState {
  const runScheduler = (tasks: Task[], links: Link[], columns: ColumnSpec[], calendars: Calendar[], defaultCalendarId: string | null): Task[] => {
      const defaultCalendar = calendars.find(c => c.id === defaultCalendarId) || calendars[0];
      if (!defaultCalendar) {
          console.warn("No default calendar found for scheduling.");
          return tasks;
      }
      const hierarchicalTasks = updateHierarchyAndSort(tasks);
      return calculateSchedule(hierarchicalTasks, links, columns, defaultCalendar);
  };

  const checkDirty = (state: ProjectState): boolean => {
      const currentView = state.views.find(v => v.id === state.currentViewId);
      if (!currentView) return true; // Custom view is always dirty
      
      const arraysAreEqual = (a: any[], b: any[]) => a.length === b.length && a.every((val, index) => val === b[index]);
      const filtersAreEqual = (a: Filter[], b: Filter[]) => {
          if (a.length !== b.length) return false;
          const aSorted = [...a].sort((x, y) => x.id.localeCompare(y.id));
          const bSorted = [...b].sort((x, y) => x.id.localeCompare(y.id));
          return aSorted.every((val, index) => 
              val.id === bSorted[index].id &&
              val.columnId === bSorted[index].columnId &&
              val.operator === bSorted[index].operator &&
              val.value === bSorted[index].value
          );
      }

      return !arraysAreEqual(state.grouping, currentView.grouping) ||
             !arraysAreEqual(state.visibleColumns, currentView.visibleColumns) ||
             !filtersAreEqual(state.filters, currentView.filters);
  };
    
  switch (action.type) {
    case 'SET_PROJECT_DATA': {
      const { tasks, links, resources, assignments, calendars } = action.payload;
      const defaultCalendarId = state.defaultCalendarId || calendars.find(c => c.name === "Standard")?.id || calendars[0]?.id || null;
      const scheduledTasks = runScheduler(tasks, links, state.columns, calendars, defaultCalendarId);
      return {
        ...state,
        tasks: scheduledTasks,
        links,
        resources,
        assignments,
        calendars,
        defaultCalendarId,
      };
    }
    case 'SET_PERSISTED_STATE': {
        const { views, settings, member } = action.payload;
        const newViews = views.length > 0 ? views : defaultViews;
        const newSettings = settings ? { ...defaultAppSettings, ...settings } : defaultAppSettings;
        const currentView = newViews.find(v => v.id === newSettings.currentViewId) || newViews[0];

        let finalVisibleColumns = newSettings.visibleColumns || initialVisibleColumns;

        if (member?.permissions?.hiddenColumns) {
            const hidden = member.permissions.hiddenColumns;
            finalVisibleColumns = finalVisibleColumns.filter(colId => !hidden.includes(colId));
        }

        const tempStateForDirtyCheck: ProjectState = {
            ...state,
            views: newViews,
            currentViewId: currentView.id,
            grouping: newSettings.grouping || [],
            visibleColumns: finalVisibleColumns,
            filters: newSettings.filters || [],
        };
        
        return {
            ...state,
            views: newViews,
            columns: newSettings.columns || initialColumns,
            uiDensity: newSettings.uiDensity || 'compact',
            ganttSettings: newSettings.ganttSettings || initialGanttSettings,
            currentViewId: currentView.id,
            grouping: newSettings.grouping || [],
            visibleColumns: finalVisibleColumns,
            filters: newSettings.filters || [],
            isDirty: checkDirty(tempStateForDirtyCheck),
        };
    }
    case 'UPDATE_TASK': {
        const { id, ...update } = action.payload;

        let requiresReschedule = false;
        if (
            'start' in update ||
            'finish' in update ||
            'duration' in update ||
            'constraintType' in update ||
            'constraintDate' in update
        ) {
            requiresReschedule = true;
        }

        const updatedTasks = state.tasks.map(t =>
            t.id === id ? { ...t, ...update } : t
        );
        
        // If an update doesn't affect the schedule, we can skip the expensive reschedule
        const finalTasks = requiresReschedule 
            ? runScheduler(updatedTasks, state.links, state.columns, state.calendars, state.defaultCalendarId)
            : updateHierarchyAndSort(updatedTasks);

        return { ...state, tasks: finalTasks, isDirty: checkDirty({ ...state, tasks: finalTasks }) };
    }
    case 'UPDATE_LINK': {
        const newLinks = state.links.map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l);
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: newLinks, tasks: reScheduledTasks };
    }
    case 'UPDATE_RESOURCE': {
        const newResources = state.resources.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r);
        return { ...state, resources: newResources };
    }
    case 'ADD_RESOURCE': {
        const newResource: Resource = {
            id: `res-${Date.now()}`,
            name: 'New Resource',
            type: 'Work',
            availability: 1,
            costPerHour: 0
        };
        const newResources = [...state.resources, newResource];
        return { ...state, resources: newResources };
    }
    case 'REMOVE_RESOURCE': {
        const { resourceId } = action.payload;
        const newResources = state.resources.filter(r => r.id !== resourceId);
        const newAssignments = state.assignments.filter(a => a.resourceId !== resourceId);
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, resources: newResources, assignments: newAssignments, tasks: reScheduledTasks };
    }
    case 'ADD_CALENDAR': {
        const newCalendar: Calendar = {
            id: `cal-${Date.now()}`,
            name: 'New Calendar',
            workingDays: [1,2,3,4,5], // Mon-Fri
            exceptions: []
        };
        const newCalendars = [...state.calendars, newCalendar];
        return { ...state, calendars: newCalendars };
    }
    case 'UPDATE_CALENDAR': {
        const newCalendars = state.calendars.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c);
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, state.defaultCalendarId);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks, isDirty: checkDirty({ ...state, calendars: newCalendars }) };
    }
     case 'REMOVE_CALENDAR': {
        const { calendarId } = action.payload;
        if (state.calendars.length <= 1) return state; // Prevent deleting the last calendar
        const newCalendars = state.calendars.filter(c => c.id !== calendarId);
        const newDefaultCalendarId = state.defaultCalendarId === calendarId ? newCalendars[0].id : state.defaultCalendarId;
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, newDefaultCalendarId);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks, defaultCalendarId: newDefaultCalendarId };
    }
    case 'ADD_NOTE_TO_TASK': {
        const { taskId, content } = action.payload;
        const newNote: Note = {
            id: `note-${Date.now()}`,
            author: 'User', // Placeholder
            content,
            timestamp: new Date(),
        };
        const updatedTasks = state.tasks.map(t =>
            t.id === taskId ? { ...t, notes: [...(t.notes || []), newNote] } : t
        );
        return { ...state, tasks: updatedTasks };
    }
    case 'SELECT_TASK': {
      const { taskId, ctrlKey, shiftKey } = action.payload;

      if (taskId === null) {
        return { ...state, selectedTaskIds: [], selectionAnchor: null };
      }

      const visibleTasks = getVisibleTasks(state.tasks);
      
      const anchorId = state.selectionAnchor || state.selectedTaskIds[0] || null;

      if (shiftKey && anchorId) {
          const anchorIndex = visibleTasks.findIndex(t => t.id === anchorId);
          const currentSelectedIndex = visibleTasks.findIndex(t => t.id === taskId);
          
          if (anchorIndex !== -1 && currentSelectedIndex !== -1) {
              const start = Math.min(anchorIndex, currentSelectedIndex);
              const end = Math.max(anchorIndex, currentSelectedIndex);
              const rangeIds = visibleTasks.slice(start, end + 1).map(t => t.id);
              
              return { ...state, selectedTaskIds: rangeIds };
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
          return { ...state, selectedTaskIds: currentSelection, selectionAnchor: taskId };
      }

      return { ...state, selectedTaskIds: [taskId], selectionAnchor: taskId };
    }
    case 'TOGGLE_TASK_COLLAPSE': {
      const newTasks = state.tasks.map(task => 
        task.id === action.payload.taskId ? { ...task, isCollapsed: !task.isCollapsed } : task
      );
      return { ...state, tasks: newTasks };
    }
    case 'COLLAPSE_ALL': {
        const shouldCollapseSelected = state.selectedTaskIds.length > 1;
        const newTasks = state.tasks.map(task => {
            if (task.isSummary) {
                if (shouldCollapseSelected) {
                    if (state.selectedTaskIds.includes(task.id)) {
                        return { ...task, isCollapsed: true };
                    }
                } else {
                    return { ...task, isCollapsed: true };
                }
            }
            return task;
        });
        return { ...state, tasks: newTasks };
    }
    case 'EXPAND_ALL': {
        const shouldExpandSelected = state.selectedTaskIds.length > 1;
        const newTasks = state.tasks.map(task => {
            if (task.isSummary) {
                if (shouldExpandSelected) {
                    if (state.selectedTaskIds.includes(task.id)) {
                        return { ...task, isCollapsed: false };
                    }
                } else {
                    return { ...task, isCollapsed: false };
                }
            }
            return task;
        });
        return { ...state, tasks: newTasks };
    }
    case 'SET_COLUMNS': {
      const newState = { ...state, visibleColumns: action.payload };
      return { ...newState, isDirty: checkDirty(newState) };
    }
     case 'RESIZE_COLUMN': {
      const { columnId, width } = action.payload;
      const newColumns = state.columns.map(c =>
        c.id === columnId ? { ...c, width } : c
      );
      return { ...state, columns: newColumns };
    }
    case 'REORDER_COLUMNS': {
      const { sourceId, targetId } = action.payload;
      const columns = [...state.columns];
      const sourceIndex = columns.findIndex(c => c.id === sourceId);
      const targetIndex = columns.findIndex(c => c.id === targetId);
  
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return state;
  
      const [removed] = columns.splice(sourceIndex, 1);
      columns.splice(targetIndex, 0, removed);
      
      return { ...state, columns };
    }
    case 'SET_UI_DENSITY': {
      return { ...state, uiDensity: action.payload };
    }
    case 'ADD_COLUMN': {
        const { name, type, options, width } = action.payload;
        const newColumn: ColumnSpec = {
            id: `custom-${Date.now()}`,
            name: name,
            width: width || 150,
            type: type,
            ...(type === 'selection' && { options: options || [] }),
        };
        const newColumns = [...state.columns, newColumn];
        const newVisibleColumns = [...state.visibleColumns, newColumn.id];
        const newState = { ...state, columns: newColumns, visibleColumns: newVisibleColumns };
        return { ...newState, isDirty: checkDirty(newState) };
    }
    case 'UPDATE_COLUMN': {
        const { id, ...updates } = action.payload;
        const newColumns = state.columns.map(c => {
            if (c.id === id) {
                const updatedColumn = { ...c, ...updates };
                if (updatedColumn.type !== 'selection') {
                    delete updatedColumn.options;
                }
                return updatedColumn;
            }
            return c;
        });
        const reScheduledTasks = runScheduler(state.tasks, state.links, newColumns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, columns: newColumns };
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

      const newState = { ...state, columns: newColumns, visibleColumns: newVisibleColumns, tasks: newTasks };
      return { ...newState, isDirty: checkDirty(newState) };
    }
    case 'SET_GROUPING': {
        const newState = { ...state, grouping: action.payload };
        return { ...newState, isDirty: checkDirty(newState) };
    }
    case 'SET_FILTERS': {
        const newState = { ...state, filters: action.payload };
        return { ...newState, isDirty: checkDirty(newState) };
    }
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
    case 'ADD_TASKS_FROM_PASTE': {
        const { data, activeCell } = action.payload;
        try {
            const parsedData = JSON.parse(data);
            if (parsedData.type === 'omniplan-tasks' && Array.isArray(parsedData.tasks)) {
                const pastedTasks: Task[] = parsedData.tasks;
                if (pastedTasks.length === 0) return state;

                const idMap = new Map<string, string>();
                pastedTasks.forEach(t => idMap.set(t.id, `task-${Date.now()}-${Math.random()}`.replace('.','')));
                
                let targetIndex = state.tasks.length;
                if (activeCell) {
                    const activeTaskIndex = state.tasks.findIndex(t => t.id === activeCell.taskId);
                    if (activeTaskIndex !== -1) {
                        targetIndex = activeTaskIndex + 1;
                    }
                }

                const orderBefore = state.tasks[targetIndex - 1]?.order ?? (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.order ?? 0)) : -1);
                const orderAfter = state.tasks[targetIndex]?.order ?? orderBefore + 2;
                const orderStep = (orderAfter - orderBefore) / (pastedTasks.length + 1);

                const newTasks: Task[] = pastedTasks.map((task, index) => {
                    const newId = idMap.get(task.id)!;
                    const newParentId = task.parentId && idMap.has(task.parentId) ? idMap.get(task.parentId) : undefined;
                    
                    return {
                        ...task,
                        id: newId,
                        parentId: newParentId,
                        percentComplete: 0,
                        start: new Date(),
                        finish: new Date(),
                        order: orderBefore + (index + 1) * orderStep,
                        // Reset calculated fields
                        isCritical: undefined,
                        totalFloat: undefined,
                        lateStart: undefined,
                        lateFinish: undefined,
                        wbs: undefined,
                        schedulingConflict: false,
                        deadlineMissed: false,
                    };
                });
                
                const allTasks = [...state.tasks];
                allTasks.splice(targetIndex, 0, ...newTasks);
                
                const scheduledTasks = runScheduler(allTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
                const newSelectedIds = newTasks.map(t => t.id);

                return { ...state, tasks: scheduledTasks, selectedTaskIds: newSelectedIds };
            }
        } catch (e) {
            // Not JSON, fall through to plain text handling
        }

        // Plain text handling
        const lines = data.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return state;
        
        if (lines.length > 1) {
            let targetIndex = state.tasks.length;
            if (activeCell) {
                const activeTaskIndex = state.tasks.findIndex(t => t.id === activeCell.taskId);
                if (activeTaskIndex > -1) {
                    targetIndex = activeTaskIndex + 1;
                }
            }
            
            const orderBefore = state.tasks[targetIndex - 1]?.order ?? (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.order ?? 0)) : -1);
            const orderAfter = state.tasks[targetIndex]?.order ?? orderBefore + lines.length + 1;
            const orderStep = (orderAfter - orderBefore) / (lines.length + 1);

            const newTasks: Task[] = lines.map((line, index) => ({
                id: `task-${Date.now()}-${index}`,
                name: line.trim(),
                start: new Date(),
                finish: new Date(),
                duration: 1,
                durationUnit: 'd',
                percentComplete: 0,
                level: 0,
                order: orderBefore + (index + 1) * orderStep,
                status: 'To Do',
            }));

            const allTasks = [...state.tasks];
            allTasks.splice(targetIndex, 0, ...newTasks);
            
            const scheduledTasks = runScheduler(allTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
            const newSelectedIds = newTasks.map(t => t.id);
            
            return { ...state, tasks: scheduledTasks, selectedTaskIds: newSelectedIds };

        } else if (lines.length === 1 && activeCell) {
            const { taskId, columnId } = activeCell;
            const value = lines[0].trim();
            
            if (columnId === 'predecessors' || columnId === 'successors') {
                 return projectReducer(state, { type: 'UPDATE_RELATIONSHIPS', payload: { taskId, field: columnId, value } });
            }
            if (columnId === 'duration') {
                const parsed = parseDuration(value);
                if (parsed) {
                    return projectReducer(state, { type: 'UPDATE_TASK', payload: { id: taskId, duration: parsed.value, durationUnit: parsed.unit } });
                }
            }
            const payload = { id: taskId, [columnId]: value };
            return projectReducer(state, { type: 'UPDATE_TASK', payload });
        }
        return state;
    }
    case 'FIND_AND_REPLACE': {
        const { find, replace } = action.payload;
        if (!find) return state;

        const findLower = find.toLowerCase();
        let changesMade = false;

        const newTasks = state.tasks.map(task => {
            if (task.name.toLowerCase().includes(findLower)) {
                changesMade = true;
                const regex = new RegExp(find, 'gi');
                return { ...task, name: task.name.replace(regex, replace) };
            }
            return task;
        });

        if (!changesMade) {
            return {
                ...state,
                notifications: [
                    ...state.notifications,
                    { id: `toast-${Date.now()}`, type: 'toast', title: 'Find and Replace', description: `Text "${find}" not found in any task names.` }
                ]
            };
        }

        return {
            ...state,
            tasks: newTasks,
            notifications: [
                ...state.notifications,
                { id: `toast-${Date.now()}`, type: 'toast', title: 'Find and Replace', description: 'Task names updated.' }
            ]
        };
    }
    case 'SET_ACTIVE_CELL': {
      if (state.editingCell && (action.payload?.taskId !== state.editingCell.taskId || action.payload?.columnId !== state.editingCell.columnId)) {
          // If we are moving away from an editing cell, stop editing.
          // The actual save logic is handled by the EditableCell's onBlur.
          return { ...state, activeCell: action.payload, editingCell: null };
      }
      return { ...state, activeCell: action.payload };
    }
    case 'START_EDITING_CELL': {
      return { ...state, activeCell: action.payload, editingCell: action.payload };
    }
    case 'STOP_EDITING_CELL': {
      return { ...state, editingCell: null };
    }
    case 'UPDATE_GANTT_SETTINGS': {
      const newState = { ...state, ganttSettings: action.payload };
      return { ...newState, isDirty: checkDirty(newState) };
    }
    case 'ADD_TASK': {
        const newId = `task-${Date.now()}`;
        const { tasks, selectedTaskIds } = state;
        const lastSelectedId = selectedTaskIds.length > 0 ? selectedTaskIds[selectedTaskIds.length - 1] : null;

        let newOrder: number;

        if (lastSelectedId) {
            const selectedIndex = tasks.findIndex(t => t.id === lastSelectedId);
            if (selectedIndex > -1) {
                const orderBefore = tasks[selectedIndex].order ?? selectedIndex;
                const nextTask = tasks[selectedIndex + 1];
                const orderAfter = nextTask ? (nextTask.order ?? selectedIndex + 1) : orderBefore + 1;
                newOrder = (orderBefore + orderAfter) / 2;
            } else {
                 const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
                 newOrder = maxOrder + 1;
            }
        } else {
            const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : -1;
            newOrder = maxOrder + 1;
        }
        
        const newTask: Task = {
            id: newId,
            name: 'New Task',
            start: new Date(),
            finish: new Date(),
            duration: 1,
            durationUnit: 'd',
            percentComplete: 0,
            level: 0,
            order: newOrder,
            status: 'To Do',
        };
        
        let newTasks = [...state.tasks];
        if (lastSelectedId) {
            const selectedIndex = newTasks.findIndex(t => t.id === lastSelectedId);
            newTasks.splice(selectedIndex + 1, 0, ...[newTask]);
        } else {
            newTasks.push(newTask);
        }
        
        const scheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks, selectedTaskIds: [newTask.id], activeCell: { taskId: newTask.id, columnId: 'name' } };
    }
    case 'REMOVE_TASK': {
        const idsToRemove = new Set(state.selectedTaskIds);
        if (idsToRemove.size === 0) return state;

        const tasksToRemove = new Set<string>();
        const findChildren = (parentId: string) => {
            state.tasks.forEach(t => {
                if (t.parentId === parentId) {
                    tasksToRemove.add(t.id);
                    findChildren(t.id);
                }
            });
        };
        idsToRemove.forEach(id => {
            tasksToRemove.add(id);
            findChildren(id);
        });

        const newTasks = state.tasks.filter(t => !tasksToRemove.has(t.id));
        const newLinks = state.links.filter(l => !tasksToRemove.has(l.source) && !tasksToRemove.has(l.target));
        
        const scheduledTasks = runScheduler(newTasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks, links: newLinks, selectedTaskIds: [] };
    }
    case 'LINK_TASKS': {
        if (state.selectedTaskIds.length < 2) return state;
        
        const existingLinkPairs = new Set(state.links.map(l => `${l.source}-${l.target}`));
        const visibleTasks = getVisibleTasks(state.tasks);
        const selectedVisibleTasks = visibleTasks.filter(t => state.selectedTaskIds.includes(t.id));

        if (selectedVisibleTasks.length < 2) return state;
        
        const newLinks: Link[] = [];

        for (let i = 0; i < selectedVisibleTasks.length - 1; i++) {
            const source = selectedVisibleTasks[i].id;
            const target = selectedVisibleTasks[i + 1].id;
            const linkKey = `${source}-${target}`;

            if (!existingLinkPairs.has(linkKey)) {
                newLinks.push({
                    id: crypto.randomUUID(),
                    source: source,
                    target: target,
                    type: 'FS',
                    lag: 0,
                });
                existingLinkPairs.add(linkKey);
            }
        }

        if (newLinks.length === 0) {
            return {
                ...state,
                notifications: [
                    ...state.notifications,
                    {
                        id: `toast-links-exist-${Date.now()}`,
                        type: 'toast',
                        title: "Links Already Exist",
                        description: "The selected tasks are already linked in sequence."
                    }
                ]
            };
        }

        const allLinks = [...state.links, ...newLinks];
        const scheduledTasks = runScheduler(state.tasks, allLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: allLinks, tasks: scheduledTasks };
    }
    case 'ADD_LINK': {
        const { source, target } = action.payload;

        if (isCycle(source, target, state.links, state.tasks)) {
            return {
                ...state,
                notifications: [
                    ...state.notifications,
                    {
                        id: `toast-cycle-${Date.now()}`,
                        type: 'toast',
                        title: "Circular Reference Error",
                        description: "This link cannot be created as it would cause a circular dependency."
                    }
                ]
            };
        }

        const newLink: Link = {
            id: crypto.randomUUID(),
            source: action.payload.source,
            target: action.payload.target,
            type: action.payload.type,
            lag: action.payload.lag,
        };
        const newLinks = [...state.links, newLink];
        const scheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: newLinks, tasks: scheduledTasks };
    }
    case 'REMOVE_LINK': {
        const { linkId } = action.payload;
        const newLinks = state.links.filter(l => l.id !== linkId);
        const scheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: newLinks, tasks: scheduledTasks };
    }
    
    case 'UPDATE_RELATIONSHIPS': {
        const { taskId, field, value } = action.payload;
        const { tasks, links, columns, calendars, defaultCalendarId } = state;
        const wbsToIdMap = new Map(tasks.filter(t => t.wbs).map(t => [t.wbs!, t.id]));
        const idToWbsMap = new Map(tasks.map(t => [t.id, t.wbs || '']));

        const existingLinks = links.filter(l => (field === 'predecessors' ? l.target : l.source) === taskId);
        const existingRelations = new Set(existingLinks.map(l => {
            const relatedTaskWbs = idToWbsMap.get(field === 'predecessors' ? l.source : l.target) || '';
            let lagString = '';
            if (l.lag > 0) lagString = `+${l.lag}d`;
            if (l.lag < 0) lagString = `${l.lag}d`;
            return `${relatedTaskWbs}${l.type}${lagString}`;
        }));
        
        const newRelationsStrings = value.split(',').map(s => s.trim()).filter(Boolean);
        const newRelationsSet = new Set(newRelationsStrings);
        
        const relationsToRemove = [...existingRelations].filter(r => !newRelationsSet.has(r));
        const relationsToAdd = [...newRelationsSet].filter(r => !existingRelations.has(r));

        const linkParseRegex = /^([\d.]+)(FS|SS|FF|SF)?([+-]\d+d)?$/i;

        for (const rel of relationsToAdd) {
            const match = rel.match(linkParseRegex);
            if (!match) continue; 
            const wbs = match[1];
            const relatedTaskId = wbsToIdMap.get(wbs);
            if (relatedTaskId && relatedTaskId !== taskId) {
                const source = field === 'predecessors' ? relatedTaskId : taskId;
                const target = field === 'predecessors' ? taskId : relatedTaskId;
                if (isCycle(source, target, links, tasks)) {
                     return {
                        ...state,
                        notifications: [
                            ...state.notifications,
                            {
                                id: `toast-cycle-${Date.now()}`,
                                type: 'toast',
                                title: "Circular Reference Error",
                                description: "One or more links could not be created as they would cause a circular dependency."
                            }
                        ]
                    };
                }
            }
        }
        
        const linksToRemove = existingLinks.filter(l => {
             const relatedTaskWbs = idToWbsMap.get(field === 'predecessors' ? l.source : l.target) || '';
             let lagString = '';
             if (l.lag > 0) lagString = `+${l.lag}d`;
             if (l.lag < 0) lagString = `${l.lag}d`;
             const relationString = `${relatedTaskWbs}${l.type}${lagString}`;
             return relationsToRemove.includes(relationString);
        });

        const newLinkObjects: Link[] = relationsToAdd.map((rel) => {
            const match = rel.match(linkParseRegex);
            if (!match) return null;
            
            const wbs = match[1];
            const type = (match[2] || 'FS').toUpperCase() as LinkType;
            const lagStr = match[3];
            const lag = lagStr ? parseInt(lagStr) : 0;
            const relatedTaskId = wbsToIdMap.get(wbs);

            if (relatedTaskId && relatedTaskId !== taskId) {
                return {
                    id: crypto.randomUUID(),
                    source: field === 'predecessors' ? relatedTaskId : taskId,
                    target: field === 'predecessors' ? taskId : relatedTaskId,
                    type,
                    lag,
                };
            }
            return null;
        }).filter((l): l is Link => l !== null);
        
        const finalLinks = [
            ...links.filter(l => !linksToRemove.some(r => r.id === l.id)),
            ...newLinkObjects
        ];
        
        const newTasks = runScheduler(tasks, finalLinks, columns, calendars, defaultCalendarId);
        return { ...state, links: finalLinks, tasks: newTasks };
    }
    case 'INDENT_TASK': {
        const tasksToIndent = state.selectedTaskIds;
        if (tasksToIndent.length === 0) return state;

        const tasks = [...state.tasks];
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const firstSelectedId = tasks.find(t => tasksToIndent.includes(t.id))?.id;
        if (!firstSelectedId) return state;

        const firstSelectedIndex = tasks.findIndex(t => t.id === firstSelectedId);
        if (firstSelectedIndex === 0) return state;
        
        const taskAbove = tasks[firstSelectedIndex - 1];
        let newParentId: string | null | undefined;
        
        if (taskAbove) {
            // If the task above is at a strictly greater level, we become a sibling to it.
            // Otherwise, we become a child of it.
            if ((taskAbove.level || 0) > (taskMap.get(firstSelectedId)!.level || 0)) {
                 newParentId = taskAbove.parentId;
            } else {
                 newParentId = taskAbove.id;
            }
        } else {
            return state;
        }

        const newParent = newParentId ? taskMap.get(newParentId) : null;

        for (const taskId of tasksToIndent) {
            let p: Task | undefined | null = newParent;
            while (p) {
                if (p.id === taskId) {
                    return state; 
                }
                p = p.parentId ? taskMap.get(p.parentId) : null;
            }
        }
        
        if (newParent && newParent.isCollapsed) {
            taskMap.get(newParent.id)!.isCollapsed = false;
        }

        const oldTaskMap = new Map(state.tasks.map(t => [t.id, {...t}]));
        const newlySummaryTasks = new Set<string>();

        tasksToIndent.forEach(taskId => {
            const taskToIndent = taskMap.get(taskId)!;
            taskToIndent.parentId = newParentId;

            if (newParentId && !oldTaskMap.get(newParentId)?.isSummary) {
                newlySummaryTasks.add(newParentId);
            }
        });

        let newLinks = [...state.links];
        const notifications: ProjectState['notifications'] = [];

        if (newlySummaryTasks.size > 0) {
            for (const parentId of newlySummaryTasks) {
                const parentTaskName = taskMap.get(parentId)?.name;
                const linksToBeRemoved = newLinks.filter(link => link.source === parentId || link.target === parentId);
                
                if (linksToBeRemoved.length > 0) {
                     newLinks = newLinks.filter(link => !linksToBeRemoved.some(l => l.id === link.id));
                     notifications.push({
                         id: `toast-${Date.now()}`,
                         type: 'toast',
                         title: "Dependencies Removed",
                         description: `Existing links on "${parentTaskName}" were removed as it became a summary task. This prevents scheduling conflicts.`
                     });
                }
            }
        }

        const updatedTasks = Array.from(taskMap.values());
        const scheduledTasks = runScheduler(updatedTasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        
        return { ...state, tasks: scheduledTasks, links: newLinks, notifications };
    }
    case 'OUTDENT_TASK': {
        if (state.selectedTaskIds.length === 0) return state;

        const tasks = [...state.tasks];
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const sortedSelectedIds = tasks
            .filter(t => state.selectedTaskIds.includes(t.id))
            .map(t => t.id);
            
        for (const taskId of sortedSelectedIds) {
            const taskToOutdent = taskMap.get(taskId)!;
            if (taskToOutdent.parentId) {
                const parent = taskMap.get(taskToOutdent.parentId);
                taskToOutdent.parentId = parent?.parentId || null;
            }
        }

        const scheduledTasks = runScheduler(Array.from(taskMap.values()), state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks };
    }
    case 'REORDER_TASKS': {
        const { sourceIds, targetId, position } = action.payload;
        
        let tasks = [...state.tasks];
        const targetIndex = tasks.findIndex(t => t.id === targetId);
        if (targetIndex === -1) return state;
        
        const sourceTasks = sourceIds.map(id => tasks.find(t => t.id === id)).filter((t): t is Task => !!t);
        const sourceOrders = sourceTasks.map(t => t.order || 0);
        tasks = tasks.filter(t => !sourceIds.includes(t.id));

        const targetTask = tasks.find(t => t.id === targetId);
        if (!targetTask) { // Should not happen if targetIndex is valid
             tasks = [...state.tasks]; // revert
             return state;
        }

        const effectiveTargetIndex = tasks.findIndex(t => t.id === targetId);

        let newOrder: number;
        if (position === 'top') {
            const orderBefore = tasks[effectiveTargetIndex - 1]?.order ?? (targetTask.order ?? effectiveTargetIndex) - 1;
            newOrder = (orderBefore + (targetTask.order ?? effectiveTargetIndex)) / 2;
        } else { // bottom
            const orderAfter = tasks[effectiveTargetIndex + 1]?.order ?? (targetTask.order ?? effectiveTargetIndex) + 1;
            newOrder = ((targetTask.order ?? effectiveTargetIndex) + orderAfter) / 2;
        }

        const orderIncrement = (Math.abs(sourceOrders[sourceOrders.length - 1] - sourceOrders[0]) / (sourceIds.length - 1 || 1)) / 1000;

        sourceTasks.forEach((task, i) => {
            task.order = newOrder + (i * orderIncrement);
        });
        
        const finalTasks = [...tasks, ...sourceTasks].sort((a,b) => (a.order || 0) - (b.order || 0));
        
        const scheduledTasks = runScheduler(finalTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks };
    }
     case 'NEST_TASKS': {
        const { sourceIds, parentId } = action.payload;
        const newTasks = state.tasks.map(t => {
            if (sourceIds.includes(t.id)) {
                return { ...t, parentId: parentId };
            }
            return t;
        });
        const scheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks };
    }
    case 'CLEAR_NOTIFICATIONS': {
        return { ...state, notifications: [] };
    }
    case 'SET_REPRESENTATION': {
        return { ...state, currentRepresentation: action.payload };
    }
    default:
      return state;
  }
}

type HistoryState = {
    past: { state: ProjectState, action: Action }[];
    present: ProjectState;
    future: { state: ProjectState, action: Action }[];
}

const historyInitialState: HistoryState = {
    past: [],
    present: initialState,
    future: [],
}

// Higher-order reducer for history
const undoable = (reducer: (state: ProjectState, action: Action) => ProjectState) => {
    return (state: HistoryState, action: Action): HistoryState => {
        const { past, present, future } = state;
        
        const nonHistoricActions = [
            'SET_PROJECT_DATA', 
            'SET_PERSISTED_STATE',
            'SELECT_TASK', 
            'SET_ACTIVE_CELL', 
            'START_EDITING_CELL', 
            'STOP_EDITING_CELL',
            'CLEAR_NOTIFICATIONS',
        ];

        if (action.type === '_APPLY_STATE_CHANGE') {
            const { newState, originalAction } = action.payload;
            if (originalAction.type === 'UNDO' || originalAction.type === 'REDO' || originalAction.type === 'JUMP_TO_HISTORY') {
                return { ...state, present: newState };
            }
            return {
                past: [...past, { state: present, action: originalAction }],
                present: newState,
                future: [],
            };
        }

        switch (action.type) {
            case 'UNDO': {
                if (past.length === 0) return state;
                const previous = past[past.length - 1];
                const newPast = past.slice(0, past.length - 1);
                return {
                    past: newPast,
                    present: previous.state,
                    future: [ { state: present, action: previous.action }, ...future ],
                };
            }
            case 'REDO': {
                if (future.length === 0) return state;
                const next = future[0];
                const newFuture = future.slice(1);
                return {
                    past: [ ...past, { state: present, action: next.action } ],
                    present: next.state,
                    future: newFuture,
                };
            }
            case 'JUMP_TO_HISTORY': {
                const { index } = action.payload;
                if (index < 0 || index >= past.length) return state;
                
                const newPast = past.slice(0, index);
                const newFuture = [
                    ...past.slice(index),
                    { state: present, action: past[past.length - 1]?.action }
                ];
                return {
                    past: newPast,
                    present: newPast.length > 0 ? newPast[newPast.length-1].state : initialState,
                    future: newFuture
                }
            }
        }
        
        const newPresent = reducer(present, action);

        if (nonHistoricActions.includes(action.type)) {
            return { ...state, present: newPresent };
        }
        
        if (action.type === 'UPDATE_TASK' && JSON.stringify(present.tasks) === JSON.stringify(newPresent.tasks)) {
             return state;
        }

        return {
            past: [ ...past, { state: present, action } ],
            present: newPresent,
            future: [],
        };
    };
};

export function useProject(user: User, projectId: string | null) {
  const [historyState, internalDispatch] = useReducer(undoable(projectReducer), historyInitialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const { data: member, isLoading: isMemberLoading } = useDoc<ProjectMember>(
      useMemoFirebase(() => (projectId && user) ? doc(firestore, 'projects', projectId, 'members', user.uid) : null, [firestore, projectId, user])
  );

  const isEditorOrOwner = useMemo(() => {
      if (isMemberLoading) {
          return false;
      }
      return !!(member && (member.role === 'editor' || member.role === 'owner'));
  }, [isMemberLoading, member]);
  
  const { data: project, isLoading: isProjectLoading } = useDoc<Project>(useMemoFirebase(() => projectId ? doc(firestore, 'projects', projectId) : null, [firestore, projectId]));

  const collections = {
    tasks: useCollection<Task>(useMemoFirebase(() => projectId ? query(collection(firestore, 'projects', projectId, 'tasks'), orderBy('order')) : null, [firestore, projectId])),
    links: useCollection<Link>(useMemoFirebase(() => projectId ? collection(firestore, 'projects', projectId, 'links') : null, [firestore, projectId])),
    resources: useCollection<Resource>(useMemoFirebase(() => projectId ? collection(firestore, 'projects', projectId, 'resources') : null, [firestore, projectId])),
    assignments: useCollection<Assignment>(useMemoFirebase(() => projectId ? collection(firestore, 'projects', projectId, 'assignments') : null, [firestore, projectId])),
    calendars: useCollection<Calendar>(useMemoFirebase(() => projectId ? collection(firestore, 'projects', projectId, 'calendars') : null, [firestore, projectId])),
    views: useCollection<View>(useMemoFirebase(() => projectId ? collection(firestore, 'projects', projectId, 'views') : null, [firestore, projectId])),
    settings: useDoc<typeof defaultAppSettings>(useMemoFirebase(() => projectId ? doc(firestore, 'projects', projectId, 'settings', 'app_settings') : null, [firestore, projectId])),
  };
  
  const handleFirestoreAction = useCallback((action: Action) => {
    if (!user || !projectId) {
        internalDispatch(action);
        return;
    }
    
    const settingsActions = [
      'SAVE_VIEW_AS', 'UPDATE_CURRENT_VIEW', 'SET_GROUPING', 'SET_FILTERS',
      'SET_COLUMNS', 'ADD_COLUMN', 'UPDATE_COLUMN', 'REMOVE_COLUMN',
      'RESIZE_COLUMN', 'REORDER_COLUMNS', 'SET_UI_DENSITY',
      'UPDATE_GANTT_SETTINGS', 'DELETE_VIEW', 'SET_VIEW'
    ];
    
    if (settingsActions.includes(action.type)) {
      if (!isEditorOrOwner) {
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'You do not have permission to change project settings.',
        });
        return;
      }
    }

    const optimisticActions: Action['type'][] = [
        'ADD_NOTE_TO_TASK',
        'UPDATE_TASK',
        'UPDATE_RESOURCE',
        'UPDATE_CALENDAR',
    ];

    if (optimisticActions.includes(action.type)) {
        internalDispatch(action);

        switch(action.type) {
            case 'ADD_NOTE_TO_TASK':
            case 'UPDATE_TASK': {
                 const taskId = (action.payload as { id: string }).id;
                 const updatedState = projectReducer(historyState.present, action);
                 const updatedTask = updatedState.tasks.find(t => t.id === taskId);
                 if (updatedTask) {
                     const { ...updateData } = toFirestoreTask(updatedTask);
                     updateDocumentNonBlocking(doc(firestore, 'projects', projectId, 'tasks', taskId), updateData);
                 }
                 break;
            }
             case 'UPDATE_RESOURCE': {
                const { id, ...updateData } = action.payload as { id: string };
                updateDocumentNonBlocking(doc(firestore, 'projects', projectId, 'resources', id), updateData);
                break;
            }
            case 'UPDATE_CALENDAR': {
                 const { id, ...updateData } = action.payload as { id: string };
                updateDocumentNonBlocking(doc(firestore, 'projects', projectId, 'calendars', id), updateData);
                break;
            }
        }
        return;
    }


    const nonOptimisticActions: Action['type'][] = [
        'UPDATE_LINK',
        'ADD_TASK', 'REMOVE_TASK', 
        'LINK_TASKS', 'ADD_LINK', 'REMOVE_LINK', 'UPDATE_RELATIONSHIPS',
        'INDENT_TASK', 'OUTDENT_TASK', 'REORDER_TASKS', 'NEST_TASKS',
        'ADD_RESOURCE', 'REMOVE_RESOURCE', 'ADD_CALENDAR', 'REMOVE_CALENDAR',
        'ADD_TASKS_FROM_PASTE',
        'FIND_AND_REPLACE',
    ];

    if (nonOptimisticActions.includes(action.type)) {
        const currentState = historyState.present;
        const newState = projectReducer(currentState, action);

        const batch = writeBatch(firestore);

        newState.tasks.forEach(newTask => {
            const oldTask = currentState.tasks.find(t => t.id === newTask.id);
            if (!oldTask) {
                batch.set(doc(firestore, 'projects', projectId, 'tasks', newTask.id), toFirestoreTask(newTask));
            } else {
                 if (JSON.stringify(toFirestoreTask(oldTask)) !== JSON.stringify(toFirestoreTask(newTask))) {
                     const { id, ...updateData } = toFirestoreTask(newTask);
                     batch.update(doc(firestore, 'projects', projectId, 'tasks', newTask.id), updateData);
                 }
            }
        });
        currentState.tasks.forEach(oldTask => {
            if (!newState.tasks.some(t => t.id === oldTask.id)) {
                batch.delete(doc(firestore, 'projects', projectId, 'tasks', oldTask.id));
            }
        });

        newState.links.forEach(newLink => {
            const oldLink = currentState.links.find(l => l.id === newLink.id);
            const { isDriving, ...linkToSave } = newLink;

            if (!oldLink) {
                 batch.set(doc(firestore, 'projects', projectId, 'links', newLink.id), linkToSave);
            } else {
                const { isDriving: oldIsDriving, ...oldLinkToCompare } = oldLink;
                 if (JSON.stringify(oldLinkToCompare) !== JSON.stringify(linkToSave)) {
                     const { id, ...updateData } = linkToSave;
                     batch.update(doc(firestore, 'projects', projectId, 'links', newLink.id), updateData);
                 }
            }
        });
        currentState.links.forEach(oldLink => {
            if (!newState.links.some(l => l.id === oldLink.id)) {
                batch.delete(doc(firestore, 'projects', projectId, 'links', oldLink.id));
            }
        });

        newState.calendars.forEach(newCalendar => {
            const oldCalendar = currentState.calendars.find(c => c.id === newCalendar.id);
            const calendarToSave = {
                ...newCalendar,
                exceptions: (newCalendar.exceptions || []).map(e => {
                    const { start, finish, ...rest } = e;
                    return { start: start, finish: finish, ...rest };
                })
            };

            if (!oldCalendar) {
                batch.set(doc(firestore, 'projects', projectId, 'calendars', newCalendar.id), calendarToSave);
            } else {
                const oldCalendarToCompare = {
                    ...oldCalendar,
                    exceptions: (oldCalendar.exceptions || []).map(e => {
                        const { start, finish, ...rest } = e;
                        return { start: start, finish: finish, ...rest };
                    })
                };
                if (JSON.stringify(oldCalendarToCompare) !== JSON.stringify(calendarToSave)) {
                     const { id, ...updateData } = calendarToSave;
                     batch.update(doc(firestore, 'projects', projectId, 'calendars', newCalendar.id), updateData);
                }
            }
        });
        currentState.calendars.forEach(oldCalendar => {
            if (!newState.calendars.some(c => c.id === oldCalendar.id)) {
                batch.delete(doc(firestore, 'projects', projectId, 'calendars', oldCalendar.id));
            }
        });
        
        newState.resources.forEach(newResource => {
            const oldResource = currentState.resources.find(r => r.id === newResource.id);
            if (!oldResource) {
                batch.set(doc(firestore, 'projects', projectId, 'resources', newResource.id), newResource);
            } else {
                if (JSON.stringify(oldResource) !== JSON.stringify(newResource)) {
                     const { id, ...updateData } = newResource;
                     batch.update(doc(firestore, 'projects', projectId, 'resources', newResource.id), updateData);
                }
            }
        });
        currentState.resources.forEach(oldResource => {
            if (!newState.resources.some(r => r.id === oldResource.id)) {
                batch.delete(doc(firestore, 'projects', projectId, 'resources', oldResource.id));
            }
        });

        batch.commit().then(() => {
            internalDispatch({ type: '_APPLY_STATE_CHANGE', payload: { newState, originalAction: action } });
        }).catch(e => {
            console.error(`Action ${action.type} failed to commit.`, e);
            toast({
              variant: 'destructive',
              title: 'Error Saving Changes',
              description: `Your action (${action.type}) could not be saved. Please try again.`,
            });
        });
        return;

    } else { // Settings & View actions can be dispatched and saved in background
        internalDispatch(action);

        switch (action.type) {
            case 'SAVE_VIEW_AS':
            case 'UPDATE_CURRENT_VIEW':
            case 'SET_GROUPING':
            case 'SET_FILTERS':
            case 'SET_COLUMNS':
            case 'ADD_COLUMN':
            case 'UPDATE_COLUMN':
            case 'REMOVE_COLUMN':
            case 'RESIZE_COLUMN':
            case 'REORDER_COLUMNS':
            case 'SET_UI_DENSITY':
            case 'UPDATE_GANTT_SETTINGS': {
                const newState = projectReducer(historyState.present, action);
                const settingsToUpdate = {
                    columns: newState.columns,
                    uiDensity: newState.uiDensity,
                    ganttSettings: newState.ganttSettings,
                    visibleColumns: newState.visibleColumns,
                    grouping: newState.grouping,
                    filters: newState.filters,
                };
                updateDocumentNonBlocking(doc(firestore, 'projects', projectId, 'settings', 'app_settings'), settingsToUpdate);

                if (action.type === 'SAVE_VIEW_AS') {
                    const newView = newState.views.find(v => v.id === newState.currentViewId);
                    if (newView) setDocumentNonBlocking(doc(firestore, 'projects', projectId, 'views', newView.id), newView, {});
                }
                if (action.type === 'UPDATE_CURRENT_VIEW' && newState.currentViewId) {
                    const updatedView = newState.views.find(v => v.id === newState.currentViewId);
                    if (updatedView) {
                        const { id, ...viewData } = updatedView;
                        updateDocumentNonBlocking(doc(firestore, 'projects', projectId, 'views', id), viewData);
                    }
                }
                break;
            }
            case 'DELETE_VIEW': {
                deleteDocumentNonBlocking(doc(firestore, 'projects', projectId, 'views', action.payload.viewId));
                break;
            }
             case 'SET_VIEW': {
                updateDocumentNonBlocking(doc(firestore, 'projects', projectId, 'settings', 'app_settings'), { currentViewId: action.payload.viewId });
                break;
            }
        }
    }
  }, [user, projectId, isEditorOrOwner, firestore, toast, historyState.present]);
  
  // Effect 1: Data Synchronization from Firestore
  useEffect(() => {
    // On project change, reset loaded state until all collections are confirmed loaded
    if(isLoaded) {
      setIsLoaded(false);
    }
  }, [projectId]);

  useEffect(() => {
    const allCollectionsLoading = collections.tasks.isLoading || collections.links.isLoading || collections.resources.isLoading || collections.assignments.isLoading || collections.calendars.isLoading;
    const allLoading = allCollectionsLoading || isMemberLoading;

    if (!projectId || allLoading) {
        return;
    };

    const safeToDate = (value: any): Date | null => {
        if (!value) return null;
        if (typeof value === 'object' && value !== null && typeof value.toDate === 'function') {
            return value.toDate();
        }
        const d = new Date(value);
        return !isNaN(d.getTime()) ? d : null;
    }

    internalDispatch({
        type: 'SET_PROJECT_DATA',
        payload: {
            tasks: (collections.tasks.data || []).map(t => ({
                ...t, 
                start: safeToDate(t.start)!, 
                finish: safeToDate(t.finish)!, 
                constraintDate: safeToDate(t.constraintDate), 
                deadline: safeToDate(t.deadline)
            })),
            links: collections.links.data || [],
            resources: collections.resources.data || [],
            assignments: collections.assignments.data || [],
            calendars: (collections.calendars.data || []).map(c => ({
                ...c, 
                exceptions: (c.exceptions || []).map(e => ({
                    ...e, 
                    start: safeToDate(e.start)!, 
                    finish: safeToDate(e.finish)!
                }))
            })),
        }
    });

    if (!isLoaded) {
        setIsLoaded(true);
    }
  }, [
    projectId, isLoaded, isMemberLoading,
    collections.tasks.data, collections.tasks.isLoading,
    collections.links.data, collections.links.isLoading,
    collections.resources.data, collections.resources.isLoading,
    collections.assignments.data, collections.assignments.isLoading,
    collections.calendars.data, collections.calendars.isLoading,
  ]);

  // Effect 2: Sync Settings Data
  useEffect(() => {
    if (!isLoaded || collections.views.isLoading || collections.settings.isLoading || isProjectLoading) return;
    
    let settingsToApply = collections.settings.data ? { ...defaultAppSettings, ...collections.settings.data } : defaultAppSettings;

    if (settingsToApply?.ganttSettings?.dateFormat) {
        try {
            format(new Date(), settingsToApply.ganttSettings.dateFormat);
        } catch (e) {
            console.warn(`Invalid date format string "${settingsToApply.ganttSettings.dateFormat}" found in settings. Resetting to default.`);
            settingsToApply.ganttSettings.dateFormat = defaultAppSettings.ganttSettings.dateFormat;
        }
    }
    
    internalDispatch({
      type: 'SET_PERSISTED_STATE',
      payload: {
        views: collections.views.data || [],
        settings: settingsToApply,
        member: member,
      }
    });
  }, [isLoaded, collections.views.data, collections.views.isLoading, collections.settings.data, collections.settings.isLoading, isProjectLoading, project, member]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey) {
            if (event.key === 'z') {
                event.preventDefault();
                internalDispatch({ type: 'UNDO' });
            } else if (event.key === 'y') {
                 event.preventDefault();
                internalDispatch({ type: 'REDO' });
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getPayloadDescription = (action: Action): string | undefined => {
    if ('payload' in action && action.payload && typeof action.payload === 'object') {
        if ('name' in action.payload) return String(action.payload.name);
        const task = historyState.present.tasks.find(t => 'id' in (action.payload as any) && t.id === (action.payload as any).id);
        if (task) return task.name;
    }
    return undefined;
  }

  return { 
    state: historyState.present, 
    dispatch: handleFirestoreAction,
    isLoaded: isLoaded && projectId,
    isEditorOrOwner,
    canUndo: historyState.past.length > 0,
    canRedo: historyState.future.length > 0,
    history: {
        log: historyState.past.map(h => ({
            actionType: h.action.type,
            payloadDescription: getPayloadDescription(h.action),
            timestamp: new Date()
        })),
        index: historyState.past.length -1
    }
  };
}
