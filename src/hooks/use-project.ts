'use client';

import { useReducer, useEffect, useState, useRef, useMemo } from 'react';
import type { ProjectState, Task, Link, ColumnSpec, UiDensity, LinkType, Resource, Assignment, Calendar, Exception, View, Note, Filter, GanttSettings, DurationUnit, HistoryEntry } from '@/lib/types';
import { initialTasks, initialLinks, initialResources, initialAssignments, initialCalendars } from '@/lib/mock-data';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';
import { format } from 'date-fns';
import { parseDuration, formatDuration } from '@/lib/duration';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { User } from 'firebase/auth';

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
};

type Action =
  | { type: 'SET_PROJECT_DATA', payload: { tasks: Task[], links: Link[], resources: Resource[], assignments: Assignment[], calendars: Calendar[] } }
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
  | { type: 'ADD_NOTE_TO_TASK_OPTIMISTIC'; payload: { taskId: string; note: Note } }
  | { type: 'ADD_TASKS_FROM_PASTE', payload: { data: string, activeCell: { taskId: string, columnId: string } | null } }
  | { type: 'SET_ACTIVE_CELL'; payload: { taskId: string; columnId: string } | null }
  | { type: 'START_EDITING_CELL', payload: { taskId: string, columnId: string, initialValue?: string } }
  | { type: 'STOP_EDITING_CELL' }
  | { type: 'UPDATE_GANTT_SETTINGS', payload: GanttSettings }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'JUMP_TO_HISTORY', payload: { index: number } };


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
    
  switch (action.type) {
    case 'SET_PROJECT_DATA': {
      const { tasks, links, resources, assignments, calendars } = action.payload;
      const scheduledTasks = runScheduler(tasks, links, state.columns, calendars, state.defaultCalendarId);
      return {
        ...state,
        tasks: scheduledTasks,
        links,
        resources,
        assignments,
        calendars,
        defaultCalendarId: calendars[0]?.id || null,
      };
    }
    case 'UPDATE_TASK': {
        const updatedTasks = state.tasks.map(t =>
            t.id === action.payload.id ? { ...t, ...action.payload } : t
        );
        const reScheduledTasks = runScheduler(updatedTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks, isDirty: true };
    }
    case 'UPDATE_LINK': {
        const newLinks = state.links.map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l);
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: newLinks, tasks: reScheduledTasks, isDirty: true };
    }
    case 'UPDATE_RESOURCE': {
        const newResources = state.resources.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r);
        return { ...state, resources: newResources, isDirty: true };
    }
    case 'UPDATE_CALENDAR': {
        const newCalendars = state.calendars.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c);
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, state.defaultCalendarId);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks, isDirty: true };
    }
    case 'ADD_NOTE_TO_TASK_OPTIMISTIC': {
        const { taskId, note } = action.payload;
        const updatedTasks = state.tasks.map(t =>
            t.id === taskId ? { ...t, notes: [...(t.notes || []), note] } : t
        );
        return { ...state, tasks: updatedTasks, isDirty: true };
    }
    case 'SELECT_TASK': {
      const { taskId, ctrlKey, shiftKey } = action.payload;

      if (taskId === null) {
        return { ...state, selectedTaskIds: [], selectionAnchor: null };
      }

      const visibleTasks = getVisibleTasks(state.tasks);
      
      // The anchor is the task that was active when shift was first pressed.
      const anchorId = state.selectionAnchor || state.selectedTaskIds[0] || null;

      if (shiftKey && anchorId) {
          const anchorIndex = visibleTasks.findIndex(t => t.id === anchorId);
          const currentSelectedIndex = visibleTasks.findIndex(t => t.id === taskId);
          
          if (anchorIndex !== -1 && currentSelectedIndex !== -1) {
              const start = Math.min(anchorIndex, currentSelectedIndex);
              const end = Math.max(anchorIndex, currentSelectedIndex);
              const rangeIds = visibleTasks.slice(start, end + 1).map(t => t.id);
              
              // Don't change the anchor during a shift-select
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
          // When ctrl-clicking, the last clicked item becomes the new anchor for subsequent shift-clicks.
          return { ...state, selectedTaskIds: currentSelection, selectionAnchor: taskId };
      }

      // Default case: simple click. Reset selection and set the anchor.
      return { ...state, selectedTaskIds: [taskId], selectionAnchor: taskId };
    }
    case 'TOGGLE_TASK_COLLAPSE': {
      const newTasks = state.tasks.map(task => 
        task.id === action.payload.taskId ? { ...task, isCollapsed: !task.isCollapsed } : task
      );
      return { ...state, tasks: newTasks };
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
    case 'ADD_TASKS_FROM_PASTE': {
        const { data, activeCell } = action.payload;
        const lines = data.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) return state;

        if (lines.length > 1) {
            const newTasks: Task[] = lines.map((line, index) => {
                const id = `task-${Date.now()}-${index}`;
                const name = line.trim();
                return {
                    id,
                    name,
                    start: new Date(),
                    finish: new Date(),
                    duration: 1,
                    percentComplete: 0,
                    level: 0,
                };
            });

            const allTasks = [...state.tasks, ...newTasks];
            const scheduledTasks = runScheduler(allTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
            return { ...state, tasks: scheduledTasks };
        } else if (lines.length === 1 && activeCell) {
            // Single line paste behaves like a cell edit
            const payload = { id: activeCell.taskId, [activeCell.columnId]: lines[0].trim() };
            return projectReducer(state, { type: 'UPDATE_TASK', payload });
        }
        return state;
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
     case 'ADD_TASK': {
        const newId = `task-${Date.now()}`;
        const newTask: Task = {
            id: newId,
            name: 'New Task',
            start: new Date(),
            finish: new Date(),
            duration: 1,
            durationUnit: 'd',
            percentComplete: 0,
            level: 0,
        };
        
        let newTasks = [...state.tasks];
        const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
        if (lastSelectedId) {
            const selectedIndex = newTasks.findIndex(t => t.id === lastSelectedId);
            newTasks.splice(selectedIndex + 1, 0, newTask);
        } else {
            newTasks.push(newTask);
        }
        
        const scheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks, isDirty: true, selectedTaskIds: [newId], activeCell: { taskId: newId, columnId: 'name' } };
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
        return { ...state, tasks: scheduledTasks, links: newLinks, isDirty: true, selectedTaskIds: [] };
    }
    case 'LINK_TASKS': {
        if (state.selectedTaskIds.length < 2) return state;
        
        const newLinks: Link[] = [];
        for (let i = 0; i < state.selectedTaskIds.length - 1; i++) {
            newLinks.push({
                id: `link-${Date.now()}-${i}`,
                source: state.selectedTaskIds[i],
                target: state.selectedTaskIds[i + 1],
                type: 'FS',
                lag: 0,
            });
        }

        const allLinks = [...state.links, ...newLinks];
        const scheduledTasks = runScheduler(state.tasks, allLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: allLinks, tasks: scheduledTasks, isDirty: true };
    }
    case 'INDENT_TASK': {
        if (state.selectedTaskIds.length === 0) return state;
        
        const tasks = [...state.tasks];
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        
        const sortedSelectedIds = tasks
            .filter(t => state.selectedTaskIds.includes(t.id))
            .map(t => t.id);

        for (const taskId of sortedSelectedIds) {
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex > 0) {
                let potentialParent = tasks[taskIndex - 1];
                if (sortedSelectedIds.includes(potentialParent.id)) continue;

                const taskToIndent = taskMap.get(taskId)!;
                taskToIndent.parentId = potentialParent.id;
            }
        }

        const scheduledTasks = runScheduler(Array.from(taskMap.values()), state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks, isDirty: true };
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
        return { ...state, tasks: scheduledTasks, isDirty: true };
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
        
        // Actions that don't get recorded in history
        const nonHistoricActions = [
            'SET_PROJECT_DATA', 
            'SELECT_TASK', 
            'SET_ACTIVE_CELL', 
            'START_EDITING_CELL', 
            'STOP_EDITING_CELL',
            'UNDO',
            'REDO',
            'JUMP_TO_HISTORY',
        ];

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
                    { state: present, action: past[past.length - 1]?.action } // a bit of a guess for the action
                ];
                return {
                    past: newPast,
                    present: newPast.length > 0 ? newPast[newPast.length-1].state : initialState, // Need to handle this better
                    future: newFuture
                }
            }
        }
        
        // For all other actions, run the main reducer
        const newPresent = reducer(present, action);

        if (nonHistoricActions.includes(action.type)) {
            // Just update the present state without affecting history
            return { ...state, present: newPresent };
        }

        // For historic actions, add to past and clear future
        return {
            past: [ ...past, { state: present, action } ],
            present: newPresent,
            future: [],
        };
    };
};

export function useProject(user: User) {
  const [historyState, dispatch] = useReducer(undoable(projectReducer), historyInitialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const firestore = useFirestore();

  const collections = {
    tasks: useCollection<Task>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'tasks') : null, [firestore, user])),
    links: useCollection<Link>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'links') : null, [firestore, user])),
    resources: useCollection<Resource>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'resources') : null, [firestore, user])),
    assignments: useCollection<Assignment>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'assignments') : null, [firestore, user])),
    calendars: useCollection<Calendar>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'calendars') : null, [firestore, user])),
  };
  
  const handleFirestoreAction = (action: Action) => {
    // Optimistically update the UI first
    dispatch(action);

    if (!user) return;
    
    // Then, commit the change to Firestore for historic actions
    switch (action.type) {
        case 'UPDATE_TASK': {
            const { id, ...payload } = action.payload;
            const docRef = doc(firestore, 'users', user.uid, 'tasks', id);
            updateDocumentNonBlocking(docRef, payload);
            break;
        }
        case 'UPDATE_LINK': {
            const { id, ...payload } = action.payload;
            const docRef = doc(firestore, 'users', user.uid, 'links', id);
            updateDocumentNonBlocking(docRef, payload);
            break;
        }
        case 'UPDATE_RESOURCE': {
            const { id, ...payload } = action.payload;
            const docRef = doc(firestore, 'users', user.uid, 'resources', id);
            updateDocumentNonBlocking(docRef, payload);
            break;
        }
        case 'UPDATE_CALENDAR': {
             const { id, ...payload } = action.payload;
            const docRef = doc(firestore, 'users', user.uid, 'calendars', id);
            updateDocumentNonBlocking(docRef, payload);
            break;
        }
        case 'ADD_NOTE_TO_TASK': {
             const { taskId, content } = action.payload;
             const task = historyState.present.tasks.find(t => t.id === taskId);
             if (task) {
                 const newNote: Note = {
                     id: `note-${Date.now()}`,
                     author: user.displayName || 'Anonymous',
                     content,
                     timestamp: new Date(),
                 };
                 const newNotes = [...(task.notes || []), newNote];
                 const docRef = doc(firestore, 'users', user.uid, 'tasks', taskId);
                 updateDocumentNonBlocking(docRef, { notes: newNotes });
             }
             break;
        }
    }
  }

  useEffect(() => {
    const { data: tasks, isLoading: tasksLoading } = collections.tasks;
    const { data: links, isLoading: linksLoading } = collections.links;
    const { data: resources, isLoading: resourcesLoading } = collections.assignments;
    const { data: assignments, isLoading: assignmentsLoading } = collections.assignments;
    const { data: calendars, isLoading: calendarsLoading } = collections.calendars;

    const isLoading = tasksLoading || linksLoading || resourcesLoading || assignmentsLoading || calendarsLoading;

    if (!isLoading && !isLoaded) {
        if ((!tasks || tasks.length === 0) && (!calendars || calendars.length === 0)) {
             const batch = writeBatch(firestore);
             initialTasks.forEach(task => {
                 const docRef = doc(firestore, 'users', user.uid, 'tasks', task.id);
                 batch.set(docRef, task);
             });
              initialLinks.forEach(link => {
                 const docRef = doc(firestore, 'users', user.uid, 'links', link.id);
                 batch.set(docRef, link);
             });
              initialResources.forEach(resource => {
                 const docRef = doc(firestore, 'users', user.uid, 'resources', resource.id);
                 batch.set(docRef, resource);
             });
              initialAssignments.forEach(assignment => {
                 const docRef = doc(firestore, 'users', user.uid, 'assignments', assignment.id);
                 batch.set(docRef, assignment);
             });
             initialCalendars.forEach(calendar => {
                 const docRef = doc(firestore, 'users', user.uid, 'calendars', calendar.id);
                 batch.set(docRef, calendar);
             });
             batch.commit();
        }
    }

    if (!isLoading) {
        setIsLoaded(true);
        const safeToDate = (value: any): Date | null => {
            if (!value) return null;
            if (typeof value.toDate === 'function') {
                return value.toDate();
            }
            return new Date(value);
        }

        dispatch({
            type: 'SET_PROJECT_DATA',
            payload: {
                tasks: (tasks || []).map(t => ({
                    ...t, 
                    start: safeToDate(t.start)!, 
                    finish: safeToDate(t.finish)!, 
                    constraintDate: safeToDate(t.constraintDate), 
                    deadline: safeToDate(t.deadline)
                })),
                links: links || [],
                resources: resources || [],
                assignments: assignments || [],
                calendars: (calendars || []).map(c => ({
                    ...c, 
                    exceptions: (c.exceptions || []).map(e => ({
                        ...e, 
                        start: safeToDate(e.start)!, 
                        finish: safeToDate(e.finish)!
                    }))
                })),
            }
        });
    }
}, [collections.tasks.data, collections.links.data, collections.resources.data, collections.assignments.data, collections.calendars.data, collections.tasks.isLoading, collections.links.isLoading, collections.resources.isLoading, collections.assignments.isLoading, collections.calendars.isLoading]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey) {
            if (event.key === 'z') {
                event.preventDefault();
                dispatch({ type: 'UNDO' });
            } else if (event.key === 'y') {
                 event.preventDefault();
                dispatch({ type: 'REDO' });
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
        const task = historyState.present.tasks.find(t => 'id' in action.payload && t.id === (action.payload as any).id);
        if (task) return task.name;
    }
    return undefined;
  }

  return { 
    state: historyState.present, 
    dispatch: handleFirestoreAction,
    isLoaded,
    canUndo: historyState.past.length > 0,
    canRedo: historyState.future.length > 0,
    history: {
        log: historyState.past.map(h => ({
            actionType: h.action.type,
            payloadDescription: getPayloadDescription(h.action),
            timestamp: new Date() // Placeholder, ideally this is stored with the action
        })),
        index: historyState.past.length -1
    }
  };
}
