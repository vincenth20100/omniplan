'use client';

import { useReducer, useEffect, useState, useMemo, isEqual } from 'react';
import type { ProjectState, Task, Link, ColumnSpec, UiDensity, LinkType, Resource, Assignment, Calendar, Exception, View, Note, Filter, GanttSettings, DurationUnit, HistoryEntry } from '@/lib/types';
import { initialTasks, initialLinks, initialResources, initialAssignments, initialCalendars } from '@/lib/mock-data';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';
import { format } from 'date-fns';
import { parseDuration, formatDuration } from '@/lib/duration';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

const initialColumns: ColumnSpec[] = ALL_COLUMNS.map(c => {
    const column: ColumnSpec = {
        id: c.id,
        name: c.name,
        width: c.defaultWidth,
        type: c.type,
    };
    if (c.options) {
        column.options = c.options;
    }
    return column;
});

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

const defaultAppSettings = {
    id: 'app_settings',
    columns: initialColumns,
    uiDensity: 'compact' as UiDensity,
    currentViewId: 'default',
    ganttSettings: initialGanttSettings,
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
  | { type: 'SET_PERSISTED_STATE', payload: { views: View[], settings: typeof defaultAppSettings | null } }
  | { type: 'SCHEDULE_PROJECT' }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'UPDATE_LINK'; payload: Partial<Link> & { id: string } }
  | { type: 'SELECT_TASK'; payload: { taskId: string | null, ctrlKey?: boolean, shiftKey?: boolean } }
  | { type: 'LINK_TASKS' }
  | { type: 'ADD_LINK'; payload: { source: string, target: string, type: LinkType, lag: number } }
  | { type: 'ADD_LINK_OPTIMISTIC'; payload: Link }
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
  | { type: 'ADD_TASK_OPTIMISTIC'; payload: { task: Task } }
  | { type: 'REMOVE_TASK' }
  | { type: 'REMOVE_LINK'; payload: { linkId: string } }
  | { type: 'REMOVE_LINK_OPTIMISTIC'; payload: { linkId: string } }
  | { type: 'REORDER_TASKS'; payload: { sourceIds: string[]; targetId: string; position: 'top' | 'bottom' } }
  | { type: 'NEST_TASKS', payload: { sourceIds: string[], parentId: string }}
  | { type: 'SET_UI_DENSITY', payload: UiDensity }
  | { type: 'UPDATE_RELATIONSHIPS', payload: { taskId: string, field: 'predecessors' | 'successors', value: string }}
  | { type: 'SET_LINKS', payload: Link[] }
  | { type: 'ADD_RESOURCE' }
  | { type: 'ADD_RESOURCE_OPTIMISTIC'; payload: { resource: Resource } }
  | { type: 'REMOVE_RESOURCE', payload: { resourceId: string } }
  | { type: 'UPDATE_RESOURCE', payload: Partial<Resource> & { id: string } }
  | { type: 'ADD_CALENDAR' }
  | { type: 'ADD_CALENDAR_OPTIMISTIC'; payload: Calendar }
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
      const scheduledTasks = runScheduler(tasks, links, state.columns, calendars, state.defaultCalendarId);
      return {
        ...state,
        tasks: scheduledTasks,
        links,
        resources,
        assignments,
        calendars,
        defaultCalendarId: state.defaultCalendarId || calendars[0]?.id || null,
      };
    }
    case 'SET_PERSISTED_STATE': {
        const { views, settings } = action.payload;
        const newViews = views.length > 0 ? views : defaultViews;
        const newSettings = settings || defaultAppSettings;
        const currentView = newViews.find(v => v.id === newSettings.currentViewId) || newViews[0];

        return {
            ...state,
            views: newViews,
            columns: newSettings.columns,
            uiDensity: newSettings.uiDensity,
            ganttSettings: newSettings.ganttSettings,
            currentViewId: currentView.id,
            grouping: currentView.grouping,
            visibleColumns: currentView.visibleColumns,
            filters: currentView.filters || [],
            isDirty: false,
        };
    }
    case 'UPDATE_TASK': {
        const updatedTasks = state.tasks.map(t =>
            t.id === action.payload.id ? { ...t, ...action.payload } : t
        );
        const reScheduledTasks = runScheduler(updatedTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: reScheduledTasks };
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
        return state;
    }
    case 'ADD_RESOURCE_OPTIMISTIC': {
        const newResources = [...state.resources, action.payload.resource];
        return { ...state, resources: newResources };
    }
    case 'REMOVE_RESOURCE': {
        const { resourceId } = action.payload;
        const newResources = state.resources.filter(r => r.id !== resourceId);
        const newAssignments = state.assignments.filter(a => a.resourceId !== resourceId);
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, resources: newResources, assignments: newAssignments, tasks: reScheduledTasks };
    }
    case 'ADD_CALENDAR':
        return state;
    case 'ADD_CALENDAR_OPTIMISTIC': {
        const newCalendars = [...state.calendars, action.payload];
        return { ...state, calendars: newCalendars };
    }
    case 'UPDATE_CALENDAR': {
        const newCalendars = state.calendars.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c);
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, state.defaultCalendarId);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks };
    }
     case 'REMOVE_CALENDAR': {
        const { calendarId } = action.payload;
        if (state.calendars.length <= 1) return state; // Prevent deleting the last calendar
        const newCalendars = state.calendars.filter(c => c.id !== calendarId);
        const newDefaultCalendarId = state.defaultCalendarId === calendarId ? newCalendars[0].id : state.defaultCalendarId;
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, newDefaultCalendarId);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks, defaultCalendarId: newDefaultCalendarId };
    }
    case 'ADD_NOTE_TO_TASK_OPTIMISTIC': {
        const { taskId, note } = action.payload;
        const updatedTasks = state.tasks.map(t =>
            t.id === taskId ? { ...t, notes: [...(t.notes || []), note] } : t
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
        const shouldCollapseSelected = state.selectedTaskIds.length > 0;
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
        const shouldExpandSelected = state.selectedTaskIds.length > 0;
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
        };
        if (options) {
            newColumn.options = options;
        }
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
                    order: state.tasks.length + index,
                };
            });

            const allTasks = [...state.tasks, ...newTasks];
            const scheduledTasks = runScheduler(allTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
            return { ...state, tasks: scheduledTasks };
        } else if (lines.length === 1 && activeCell) {
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
      return { ...state, ganttSettings: action.payload };
    }
     case 'ADD_TASK': {
        return state;
    }
    case 'ADD_TASK_OPTIMISTIC': {
        const newTask = action.payload.task;
        
        let newTasks = [...state.tasks];
        const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
        if (lastSelectedId) {
            const selectedIndex = newTasks.findIndex(t => t.id === lastSelectedId);
            newTasks.splice(selectedIndex + 1, 0, newTask);
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
        return { ...state, links: allLinks, tasks: scheduledTasks };
    }
    case 'ADD_LINK': 
        return state;
    
    case 'ADD_LINK_OPTIMISTIC': {
        const newLinks = [...state.links, action.payload];
        const scheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: newLinks, tasks: scheduledTasks };
    }

    case 'REMOVE_LINK':
        return state;

    case 'REMOVE_LINK_OPTIMISTIC': {
        const { linkId } = action.payload;
        const newLinks = state.links.filter(l => l.id !== linkId);
        const scheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: newLinks, tasks: scheduledTasks };
    }
    
    case 'UPDATE_RELATIONSHIPS':
        return state;

    case 'SET_LINKS': {
        const newLinks = action.payload;
        const scheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, links: newLinks, tasks: scheduledTasks };
    }
    case 'INDENT_TASK': {
        if (state.selectedTaskIds.length === 0) return state;

        const tasks = [...state.tasks];
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        
        const sortedSelectedIds = tasks
            .filter(t => state.selectedTaskIds.includes(t.id))
            .map(t => t.id);

        if (sortedSelectedIds.length === 0) return state;

        const firstSelectedIndex = tasks.findIndex(t => t.id === sortedSelectedIds[0]);

        if (firstSelectedIndex === 0) return state;
        
        let parentTask: Task | undefined = undefined;
        let potentialParentIndex = firstSelectedIndex - 1;

        while(potentialParentIndex >= 0) {
            const p = tasks[potentialParentIndex];
            if (!state.selectedTaskIds.includes(p.id)) {
                 parentTask = p;
                 break;
            }
            potentialParentIndex--;
        }
        
        if (!parentTask) return state;

        for (const taskId of sortedSelectedIds) {
            const taskToIndent = taskMap.get(taskId)!;
            taskToIndent.parentId = parentTask.id;
        }

        const scheduledTasks = runScheduler(Array.from(taskMap.values()), state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { ...state, tasks: scheduledTasks };
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

        if (nonHistoricActions.includes(action.type) || action.type.endsWith('_OPTIMISTIC')) {
            return { ...state, present: newPresent };
        }

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
  const [isSeeding, setIsSeeding] = useState(false);
  const firestore = useFirestore();

  const collections = {
    tasks: useCollection<Task>(useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'tasks'), orderBy('order')) : null, [firestore, user])),
    links: useCollection<Link>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'links') : null, [firestore, user])),
    resources: useCollection<Resource>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'resources') : null, [firestore, user])),
    assignments: useCollection<Assignment>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'assignments') : null, [firestore, user])),
    calendars: useCollection<Calendar>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'calendars') : null, [firestore, user])),
    views: useCollection<View>(useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'views') : null, [firestore, user])),
    settings: useDoc<typeof defaultAppSettings>(useMemoFirebase(() => user ? doc(firestore, 'users', user.uid, 'settings', 'app_settings') : null, [firestore, user])),
  };
  
  const handleFirestoreAction = (action: Action) => {
    if (!user) {
        dispatch(action);
        return;
    }
    
    // Dispatch local/optimistic update first
    dispatch(action);

    // Then handle persistence
    switch (action.type) {
        case 'ADD_TASK': {
            const newId = `task-${Date.now()}`;
            const { tasks, selectedTaskIds } = historyState.present;
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
            };
            const docRef = doc(firestore, 'users', user.uid, 'tasks', newTask.id);
            setDocumentNonBlocking(docRef, newTask, {});
            dispatch({ type: 'ADD_TASK_OPTIMISTIC', payload: { task: newTask } });
            break;
        }

        case 'ADD_RESOURCE': {
            const newResource: Resource = {
                id: `res-${Date.now()}`,
                name: 'New Resource',
                type: 'Work',
                availability: 1,
                costPerHour: 0
            };
            const docRef = doc(firestore, 'users', user.uid, 'resources', newResource.id);
            setDocumentNonBlocking(docRef, newResource, {});
            dispatch({ type: 'ADD_RESOURCE_OPTIMISTIC', payload: { resource: newResource } });
            break;
        }

        case 'ADD_CALENDAR': {
             const newCalendar: Calendar = {
                id: `cal-${Date.now()}`,
                name: 'New Calendar',
                workingDays: [1,2,3,4,5], // Mon-Fri
                exceptions: []
            };
            const docRef = doc(firestore, 'users', user.uid, 'calendars', newCalendar.id);
            setDocumentNonBlocking(docRef, newCalendar, {});
            dispatch({ type: 'ADD_CALENDAR_OPTIMISTIC', payload: newCalendar });
            break;
        }

        case 'REMOVE_TASK': {
            const idsToRemove = new Set(historyState.present.selectedTaskIds);
            if (idsToRemove.size > 0) {
                const batch = writeBatch(firestore);
                idsToRemove.forEach(id => {
                    const docRef = doc(firestore, 'users', user.uid, 'tasks', id);
                    batch.delete(docRef);
                });
                batch.commit().catch(e => console.error("Failed to batch delete tasks", e));
            }
            break;
        }
        
        case 'REMOVE_RESOURCE': {
            const { resourceId } = action.payload;
            const batch = writeBatch(firestore);
            const resourceDocRef = doc(firestore, 'users', user.uid, 'resources', resourceId);
            batch.delete(resourceDocRef);

            const assignmentsToRemove = historyState.present.assignments.filter(a => a.resourceId === resourceId);
            assignmentsToRemove.forEach(assignment => {
                const assignmentDocRef = doc(firestore, 'users', user.uid, 'assignments', assignment.id);
                batch.delete(assignmentDocRef);
            });
            batch.commit().catch(e => console.error("Failed to batch delete resource", e));
            break;
        }

        case 'REMOVE_CALENDAR': {
             const { calendarId } = action.payload;
             const docRef = doc(firestore, 'users', user.uid, 'calendars', calendarId);
             deleteDocumentNonBlocking(docRef);
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
                dispatch({ type: 'ADD_NOTE_TO_TASK_OPTIMISTIC', payload: { taskId, note: newNote }})
            }
            break;
        }

        case 'ADD_LINK': {
            const newLink: Link = {
                id: `link-${Date.now()}`,
                source: action.payload.source,
                target: action.payload.target,
                type: action.payload.type,
                lag: action.payload.lag,
            };
            const docRef = doc(firestore, 'users', user.uid, 'links', newLink.id);
            setDocumentNonBlocking(docRef, newLink, {});
            dispatch({ type: 'ADD_LINK_OPTIMISTIC', payload: newLink });
            break;
        }

        case 'REMOVE_LINK': {
            const { linkId } = action.payload;
            const docRef = doc(firestore, 'users', user.uid, 'links', linkId);
            deleteDocumentNonBlocking(docRef);
            dispatch({ type: 'REMOVE_LINK_OPTIMISTIC', payload: { linkId } });
            break;
        }

        case 'UPDATE_RELATIONSHIPS': {
            const { taskId, field, value } = action.payload;
            const { tasks, links } = historyState.present;
            const wbsToIdMap = new Map(tasks.map(t => [t.wbs, t.id]));
            const idToWbsMap = new Map(tasks.map(t => [t.id, t.wbs]));

            const existingLinks = links.filter(l => (field === 'predecessors' ? l.target : l.source) === taskId);
            const existingRelations = new Set(existingLinks.map(l => {
                const relatedTaskWbs = idToWbsMap.get(field === 'predecessors' ? l.source : l.target) || '';
                let lagString = '';
                if (l.lag > 0) lagString = `+${l.lag}d`;
                if (l.lag < 0) lagString = `${l.lag}d`;
                return `${relatedTaskWbs}${l.type}${lagString}`;
            }));
            
            const newRelations = new Set(value.split(',').map(s => s.trim()).filter(Boolean));
            
            const relationsToRemove = [...existingRelations].filter(r => !newRelations.has(r));
            const relationsToAdd = [...newRelations].filter(r => !existingRelations.has(r));

            const linksToRemove = existingLinks.filter(l => {
                 const relatedTaskWbs = idToWbsMap.get(field === 'predecessors' ? l.source : l.target) || '';
                 let lagString = '';
                 if (l.lag > 0) lagString = `+${l.lag}d`;
                 if (l.lag < 0) lagString = `${l.lag}d`;
                 const relationString = `${relatedTaskWbs}${l.type}${lagString}`;
                 return relationsToRemove.includes(relationString);
            });

            const linkParseRegex = /^(\d+(?:\.\d+)*)(FS|SS|FF|SF)?([+-]\d+d)?$/i;
            const linksToAddData: Omit<Link, 'id'>[] = relationsToAdd.map(rel => {
                const match = rel.match(linkParseRegex);
                if (!match) return null;
                
                const wbs = match[1];
                const type = (match[2] || 'FS').toUpperCase() as LinkType;
                const lagStr = match[3];
                const lag = lagStr ? parseInt(lagStr) : 0;
                const relatedTaskId = wbsToIdMap.get(wbs);

                if (relatedTaskId && relatedTaskId !== taskId) {
                    return {
                        source: field === 'predecessors' ? relatedTaskId : taskId,
                        target: field === 'predecessors' ? taskId : relatedTaskId,
                        type,
                        lag,
                    };
                }
                return null;
            }).filter((l): l is Omit<Link, 'id'> => l !== null);

            const batch = writeBatch(firestore);
            
            linksToRemove.forEach(link => {
                const docRef = doc(firestore, 'users', user.uid, 'links', link.id);
                batch.delete(docRef);
            });

            const newLinkObjects: Link[] = linksToAddData.map((linkData, i) => ({
                 id: `link-${Date.now()}-${i}`,
                ...linkData
            }));

            newLinkObjects.forEach(linkObj => {
                const docRef = doc(firestore, 'users', user.uid, 'links', linkObj.id);
                batch.set(docRef, linkObj);
            });

            batch.commit().catch(error => console.error("Failed to update relationships in batch", error));

            const finalLinks = [
                ...links.filter(l => !linksToRemove.some(r => r.id === l.id)),
                ...newLinkObjects
            ];
            
            dispatch({ type: 'SET_LINKS', payload: finalLinks });
            break;
        }

        case 'UPDATE_TASK':
        case 'UPDATE_LINK':
        case 'UPDATE_RESOURCE':
        case 'UPDATE_CALENDAR':
        case 'NEST_TASKS':
        case 'REORDER_TASKS':
        case 'INDENT_TASK':
        case 'OUTDENT_TASK': {
            const batch = writeBatch(firestore);
            const { tasks } = projectReducer(historyState.present, action);
             tasks.forEach(task => {
                const docRef = doc(firestore, 'users', user.uid, 'tasks', task.id);
                const { id, ...rest } = task;
                batch.update(docRef, { ...rest });
            });
            batch.commit().catch(e => console.error("Failed to batch update tasks", e));
            break;
        }

        // Settings and Views
        case 'SAVE_VIEW_AS': {
            const { name } = action.payload;
            const newView: View = {
              id: `view-${Date.now()}`,
              name,
              grouping: historyState.present.grouping,
              visibleColumns: historyState.present.visibleColumns,
              filters: historyState.present.filters,
            };
            const docRef = doc(firestore, 'users', user.uid, 'views', newView.id);
            setDocumentNonBlocking(docRef, newView, {});
            break;
        }
        case 'UPDATE_CURRENT_VIEW': {
             const { currentViewId, views, grouping, visibleColumns, filters } = historyState.present;
             if (currentViewId) {
                const updatedView = { ...views.find(v => v.id === currentViewId), grouping, visibleColumns, filters };
                const docRef = doc(firestore, 'users', user.uid, 'views', currentViewId);
                updateDocumentNonBlocking(docRef, updatedView);
             }
             break;
        }
        case 'DELETE_VIEW': {
             const { viewId } = action.payload;
             const docRef = doc(firestore, 'users', user.uid, 'views', viewId);
             deleteDocumentNonBlocking(docRef);
             break;
        }
        case 'SET_VIEW': {
            const docRef = doc(firestore, 'users', user.uid, 'settings', 'app_settings');
            updateDocumentNonBlocking(docRef, { currentViewId: action.payload.viewId });
            break;
        }
        case 'SET_COLUMNS':
        case 'RESIZE_COLUMN':
        case 'REORDER_COLUMNS':
        case 'ADD_COLUMN':
        case 'UPDATE_COLUMN':
        case 'REMOVE_COLUMN':
        case 'SET_UI_DENSITY':
        case 'UPDATE_GANTT_SETTINGS': {
            const newState = projectReducer(historyState.present, action);
            const settingsToUpdate = {
                columns: newState.columns,
                uiDensity: newState.uiDensity,
                ganttSettings: newState.ganttSettings,
                visibleColumns: newState.visibleColumns, // Though this is part of a view...
            }
            const docRef = doc(firestore, 'users', user.uid, 'settings', 'app_settings');
            updateDocumentNonBlocking(docRef, settingsToUpdate);
            break;
        }
    }
  }

  useEffect(() => {
    const { data: tasks, isLoading: tasksLoading } = collections.tasks;
    const { data: links, isLoading: linksLoading } = collections.links;
    const { data: resources, isLoading: resourcesLoading } = collections.resources;
    const { data: assignments, isLoading: assignmentsLoading } = collections.assignments;
    const { data: calendars, isLoading: calendarsLoading } = collections.calendars;
    const { data: views, isLoading: viewsLoading } = collections.views;
    const { data: settings, isLoading: settingsLoading } = collections.settings;

    const isLoading = tasksLoading || linksLoading || resourcesLoading || assignmentsLoading || calendarsLoading || viewsLoading || settingsLoading;
    
    if (isSeeding || isLoading) return;

    if (!isLoaded && user) {
        const needsProjectSeeding = !tasks || tasks.length === 0;
        const needsCalendarSeeding = !calendars || calendars.length === 0;
        const needsViewsSeeding = !views || views.length === 0;
        const needsSettingsSeeding = !settings;
        
        const needsSeeding = needsProjectSeeding || needsCalendarSeeding || needsViewsSeeding || needsSettingsSeeding;

        if (needsSeeding) {
             setIsSeeding(true);
             const batch = writeBatch(firestore);
             
             if (needsProjectSeeding) {
                 initialTasks.forEach((task, index) => {
                     const docRef = doc(firestore, 'users', user.uid, 'tasks', task.id);
                     batch.set(docRef, { ...task, order: index });
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
             }
             if (needsCalendarSeeding) {
                 initialCalendars.forEach(calendar => {
                     const docRef = doc(firestore, 'users', user.uid, 'calendars', calendar.id);
                     batch.set(docRef, calendar);
                 });
             }
             if (needsViewsSeeding) {
                 defaultViews.forEach(view => {
                     const docRef = doc(firestore, 'users', user.uid, 'views', view.id);
                     batch.set(docRef, view);
                 });
             }
             if (needsSettingsSeeding) {
                 const docRef = doc(firestore, 'users', user.uid, 'settings', 'app_settings');
                 batch.set(docRef, defaultAppSettings);
             }

             batch.commit().finally(() => {
                setIsSeeding(false);
             });
             return;
        } else {
             setIsLoaded(true);
        }
    }

    if (isLoaded) {
        const safeToDate = (value: any): Date | null => {
            if (!value) return null;
            if (typeof value === 'object' && value !== null && typeof value.toDate === 'function') {
                return value.toDate();
            }
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                return d;
            }
            return null;
        }
        
        dispatch({
            type: 'SET_PERSISTED_STATE',
            payload: {
                views: views || [],
                settings: settings ? { ...defaultAppSettings, ...settings } : null
            }
        });
        
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

}, [
    collections.tasks.data, collections.links.data, collections.resources.data, collections.assignments.data, collections.calendars.data, collections.views.data, collections.settings.data,
    collections.tasks.isLoading, collections.links.isLoading, collections.resources.isLoading, collections.assignments.isLoading, collections.calendars.isLoading, collections.views.isLoading, collections.settings.isLoading,
    isLoaded, isSeeding, firestore, user
]);


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
            timestamp: new Date()
        })),
        index: historyState.past.length -1
    }
  };
}
