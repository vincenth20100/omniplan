'use client';

import { useReducer, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { ProjectState, Task, Link, ColumnSpec, UiDensity, LinkType, Resource, Assignment, Calendar, Exception, View, Note, Filter, GanttSettings, HistoryEntry, Representation, Project, ProjectMember, StylePreset, Baseline, Snapshot, PersistentHistoryEntry, SelectionMode } from '@/lib/types';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';
import { format } from 'date-fns';
import { parseDuration, formatDuration } from '@/lib/duration';
import type { AppUser as User } from '@/types/auth';
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from './use-is-admin';
import { ALL_COLUMNS, initialColumns, initialVisibleColumns } from '@/lib/columns';
import { THEME_PRESETS } from '@/lib/theme-config';
import { projectApi } from '@/services/project-api';


const defaultViews: View[] = [
    { id: 'default', name: 'Default View', grouping: [], visibleColumns: initialVisibleColumns, filters: [] }
];

export const initialGanttSettings: GanttSettings = {
  viewMode: 'day',
  showDependencies: true,
  showProgress: true,
  highlightNonWorkingTime: true,
  showTodayLine: true,
  showTaskLabels: true,
  tooltipFields: ['name', 'start', 'duration', 'finish'],
  tableTooltipFields: ['name', 'start', 'duration', 'finish'],
  showGanttTooltip: true,
  showTableTooltip: true,
  highlightCriticalPath: true,
  renderSplitTasks: false,
  dateFormat: 'MMM d, yyyy',
  summaryDurationUnit: 'day',
  theme: 'dark',
  customStyles: {},
  comparisonBaselineId: null,
  buttonLocation: 'top',
};

const defaultStylePresets: StylePreset[] = THEME_PRESETS;

const defaultAppSettings = {
    id: 'app_settings',
    columns: initialColumns,
    visibleColumns: initialVisibleColumns,
    grouping: [] as string[],
    filters: [] as Filter[],
    stylePresets: defaultStylePresets,
    expandedSubprojectIds: [] as string[],
};

const defaultUserPreferences = {
    uiDensity: 'compact' as UiDensity,
    currentViewId: 'default' as string | null,
    ganttSettings: initialGanttSettings,
    activeStylePresetId: 'default-dark' as string | null,
    collapsedTaskIds: [] as string[],
};


export const initialProjectState: ProjectState = {
  tasks: [],
  links: [],
  resources: [],
  assignments: [],
  zones: [],
  calendars: [],
  defaultCalendarId: null,
  baselines: [],
  projectColors: {},
  projectTextColors: {},
  projectCriticalPathColors: {},
  
  // Selection
  selectionMode: 'row',
  selectedTaskIds: [],
  selectionAnchor: null,
  focusCell: null,
  anchorCell: null,
  editingCell: null,

  // View
  visibleColumns: initialVisibleColumns,
  columns: initialColumns,
  uiDensity: 'compact',
  grouping: [],
  groupingState: { mode: 'expanded', overrides: [] },
  filters: [],
  views: defaultViews,
  currentViewId: 'default',
  isDirty: false,
  multiSelectMode: false,
  ganttSettings: initialGanttSettings,
  stylePresets: defaultStylePresets,
  activeStylePresetId: 'default-dark',
  notifications: [],
  currentRepresentation: 'gantt',
  sortColumn: null,
  sortDirection: null,
};

type Action =
  | { type: 'SET_PROJECT_DATA', payload: { tasks: Task[], links: Link[], resources: Resource[], assignments: Assignment[], calendars: Calendar[], baselines: Baseline[], projectColors: Record<string, string>, projectTextColors: Record<string, string>, projectCriticalPathColors: Record<string, string> } }
  | { type: 'SET_PERSISTED_STATE', payload: { views: View[], sharedSettings: typeof defaultAppSettings | null, userPreferences: typeof defaultUserPreferences | null, member: ProjectMember | null } }
  | { type: 'SCHEDULE_PROJECT' }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'UPDATE_LINK'; payload: Partial<Link> & { id: string } }
  | { type: 'SET_ROW_SELECTION', payload: { taskId: string, shiftKey?: boolean, ctrlKey?: boolean } }
  | { type: 'SET_CELL_SELECTION', payload: { taskId: string, columnId: string, shiftKey?: boolean, ctrlKey?: boolean } }
  | { type: 'LINK_TASKS' }
  | { type: 'ADD_LINK'; payload: { source: string, target: string, type: LinkType, lag: number } }
  | { type: 'SET_CONFLICTS'; payload: { taskId: string, conflictDescription: string }[] }
  | { type: 'TOGGLE_TASK_COLLAPSE'; payload: { taskId: string } }
  | { type: 'TOGGLE_GROUP'; payload: { groupId: string } }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'EXPAND_ALL' }
  | { type: 'MOVE_SELECTION'; payload: { direction: 'up' | 'down' } }
  | { type: 'SET_COLUMNS'; payload: string[] }
  | { type: 'RESIZE_COLUMN'; payload: { columnId: string, width: number } }
  | { type: 'REORDER_COLUMNS'; payload: { sourceId: string, targetId: string } }
  | { type: 'INDENT_TASK' }
  | { type: 'OUTDENT_TASK' }
  | { type: 'ADD_TASK'; payload?: { id: string, projectId?: string } }
  | { type: 'REMOVE_TASK' }
  | { type: 'REMOVE_LINK'; payload: { linkId: string } }
  | { type: 'REORDER_TASKS'; payload: { sourceIds: string[]; targetId: string; position: 'top' | 'bottom' } }
  | { type: 'NEST_TASKS', payload: { sourceIds: string[], parentId: string }}
  | { type: 'SET_UI_DENSITY', payload: UiDensity }
  | { type: 'UPDATE_RELATIONSHIPS', payload: { taskId: string, field: 'predecessors' | 'successors', value: string }}
  | { type: 'ADD_RESOURCE', payload?: { id?: string, name?: string, initials?: string } }
  | { type: 'REMOVE_RESOURCE', payload: { resourceId: string } }
  | { type: 'REORDER_RESOURCE', payload: { sourceId: string, targetId: string, position: 'top' | 'bottom' } }
  | { type: 'UPDATE_RESOURCE', payload: Partial<Resource> & { id: string } }
  | { type: 'ADD_ASSIGNMENT', payload: { taskId: string, resourceId: string, units?: number } }
  | { type: 'UPDATE_ASSIGNMENT', payload: { id: string, units: number } }
  | { type: 'REMOVE_ASSIGNMENT', payload: { id: string } }
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
  | { type: 'SET_MULTI_SELECT_MODE', payload: boolean }
  | { type: 'ADD_NOTE_TO_TASK'; payload: { taskId: string; content: string; userId?: string; author?: string } }
  | { type: 'UPDATE_NOTE'; payload: { taskId: string; noteId: string; content: string } }
  | { type: 'DELETE_NOTE'; payload: { taskId: string; noteId: string } }
  | { type: 'ADD_TASKS_FROM_PASTE', payload: { data: string, activeCell: { taskId: string, columnId: string } | null, projectId?: string } }
  | { type: 'START_EDITING_CELL', payload: { taskId: string, columnId: string, initialValue?: string } }
  | { type: 'STOP_EDITING_CELL' }
  | { type: 'UPDATE_GANTT_SETTINGS', payload: GanttSettings }
  | { type: 'SET_STYLE_PRESETS', payload: StylePreset[] }
  | { type: 'SET_ACTIVE_STYLE_PRESET', payload: { id: string } }
  | { type: 'ADD_BASELINE', payload: { name: string } }
  | { type: 'DELETE_BASELINE', payload: { baselineId: string } }
  | { type: '_APPLY_STATE_CHANGE', payload: { newState: ProjectState, originalAction: Action } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'JUMP_TO_HISTORY', payload: { index: number } }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'FIND_AND_REPLACE', payload: { find: string; replace: string } }
  | { type: 'SET_REPRESENTATION', payload: Representation }
  | { type: 'SORT_TASKS', payload: { columnId: string } }
  | { type: 'LOAD_PROJECT_DATA', payload: { tasks: any[]; links: any[]; resources: any[]; assignments: any[] } }
  | { type: 'SYNC_TASKS', payload: any[] }
  | { type: 'SYNC_LINKS', payload: any[] }
  | { type: 'UPDATE_SELECTION', payload: { mode: SelectionMode; taskId: string | null } };

const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    const res: any = {};
    for (const k in obj) {
        res[k] = sanitizeForFirestore(obj[k]);
    }
    return res;
};

/**
 * Creates a "clean" task object suitable for Firestore,
 * removing calculated fields and converting `undefined` to `null`.
 */
const toFirestoreTask = (task: Task, options?: { keepViewOptions?: boolean }) => {
  const { isCritical, totalFloat, lateStart, lateFinish, projectId, projectName, criticalFor, ...rest } = task;

  const cleanTask: Record<string, any> = { ...rest };

  if (!options?.keepViewOptions) {
      delete cleanTask.isCollapsed;
  }

  const sanitized = sanitizeForFirestore(cleanTask);
  
  if (sanitized.notes) {
      sanitized.notes = sanitized.notes.map((n: Note) => ({...n, timestamp: n.timestamp}));
  }
  
  return sanitized;
};

const toFirestoreResource = (resource: Resource) => {
    const cleanResource: Record<string, any> = { ...resource };
    for (const key in cleanResource) {
        if (cleanResource[key] === undefined) {
            cleanResource[key] = null;
        }
    }
    return cleanResource;
}

const getPayloadDescription = (action: Action, tasks: Task[]): string | undefined => {
    if ('payload' in action && action.payload && typeof action.payload === 'object') {
        if ('name' in action.payload) return String((action.payload as any).name);
        const task = tasks.find(t => 'id' in (action.payload as any) && t.id === (action.payload as any).id);
        if (task) return task.name;
    }
    return undefined;
}

const getHistoryDetails = (action: Action, state: ProjectState): { description: string | undefined, details: any } => {
    let description = getPayloadDescription(action, state.tasks);
    let details: any = null;

    if (action.type === 'REMOVE_TASK') {
        const idsToRemove = getTaskIdsInSelection(state);
        const tasksToRemove = state.tasks.filter(t => idsToRemove.has(t.id));
        if (tasksToRemove.length > 0) {
             description = tasksToRemove.length === 1
                ? `Task "${tasksToRemove[0].name}"`
                : `${tasksToRemove.length} tasks`;

             details = {
                 deletedTasks: tasksToRemove.map(t => ({ id: t.id, name: t.name }))
             };
        }
    } else if (action.type === 'UPDATE_TASK') {
         const task = state.tasks.find(t => t.id === action.payload.id);
         if (task) {
             const changes: any = {};
             for (const key in action.payload) {
                 if (key !== 'id') {
                    const fromVal = (task as any)[key];
                    const toVal = (action.payload as any)[key];
                    // Simple equality check, can be improved for objects/dates
                    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
                        changes[key] = { from: fromVal, to: toVal };
                    }
                 }
             }
             if (Object.keys(changes).length > 0) {
                 details = { changes, taskName: task.name, taskId: task.id };
             }
         }
    }

    return { description, details };
}

const sanitizeRestoredTask = (task: any): Task => {
    const sanitized = { ...task };
    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === null) {
            sanitized[key] = undefined;
        }
    });
    return sanitized as Task;
}

function useSubprojectData(_subprojectIds: string[] | undefined, _firestore: any) {
    // TODO(T5): implement via API
    const [data] = useState<{ subprojects: { tasks: Task[], links: Link[], projectName: string, projectId: string, initials?: string, color?: string, textColor?: string, criticalPathColor?: string }[] }>({ subprojects: [] });

    return data;
}

function useExternalData(_projectId: string | null, _firestore: any, _localLinks: Link[] | null) {
    // TODO(T5): implement via API
    return { links: [] as Link[], tasks: [] as Task[] };
}

function updateHierarchyAndSort(tasks: Task[]): Task[] {
    const ghostTasks = tasks.filter(t => t.isGhost);
    const internalTasks = tasks.filter(t => !t.isGhost);

    const taskMap = new Map(internalTasks.map(t => ({ ...t })).map(t => [t.id, t]));
    
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

    const originalIndices = new Map(internalTasks.map((t, i) => [t.id, i]));
    rootTasks.sort((a, b) => (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0));
    
    for (const children of childrenMap.values()) {
        children.sort((a, b) => (originalIndices.get(a) ?? 0) - (originalIndices.get(b) ?? 0));
    }

    const visited = new Set<string>();

    function traverse(taskId: string, level: number, wbs: string) {
        if (visited.has(taskId)) return;
        visited.add(taskId);

        const task = taskMap.get(taskId)!;
        task.level = level;
        task.wbs = wbs;

        const childrenIds = childrenMap.get(taskId) || [];
        childrenIds.forEach((childId, index) => {
            traverse(childId, level + 1, `${wbs}.${index + 1}`);
        });
    }

    let rootIndex = 0;
    rootTasks.forEach((task) => {
        rootIndex++;
        traverse(task.id, 0, `${rootIndex}`);
    });

    // Handle unvisited tasks (cycles or orphans)
    while (visited.size < taskMap.size) {
        const unvisited = Array.from(taskMap.values()).filter(t => !visited.has(t.id));
        if (unvisited.length === 0) break;

        // Sort by original order to be deterministic
        unvisited.sort((a, b) => (originalIndices.get(a.id) ?? 0) - (originalIndices.get(b.id) ?? 0));

        const nextRoot = unvisited[0];
        // Break the cycle/orphanage by making it a root
        nextRoot.parentId = null;

        rootIndex++;
        traverse(nextRoot.id, 0, `${rootIndex}`);
    }

    const finalTasks = Array.from(taskMap.values());
    finalTasks.sort((a, b) => (a.wbs || '').localeCompare(b.wbs || '', undefined, { numeric: true, sensitivity: 'base' }));

    return [...finalTasks, ...ghostTasks];
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

function getTaskIdsInSelection(state: ProjectState): Set<string> {
    const taskIds = new Set(state.selectedTaskIds);

    if (state.selectionMode === 'cell' && state.anchorCell && state.focusCell) {
        const visibleTasks = getVisibleTasks(state.tasks);
        
        const r1 = visibleTasks.findIndex(t => t.id === state.anchorCell!.taskId);
        const r2 = visibleTasks.findIndex(t => t.id === state.focusCell!.taskId);

        if (r1 !== -1 && r2 !== -1) {
            const rowStart = Math.min(r1, r2);
            const rowEnd = Math.max(r1, r2);

            for (let i = rowStart; i <= rowEnd; i++) {
                taskIds.add(visibleTasks[i].id);
            }
        }
    }
    return taskIds;
}

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

export function projectReducer(state: ProjectState, action: Action): ProjectState {
  const runScheduler = (tasks: Task[], links: Link[], columns: ColumnSpec[], calendars: Calendar[], defaultCalendarId: string | null, assignments: Assignment[] = [], resources: Resource[] = []): Task[] => {
      let defaultCalendar = calendars.find(c => c.id === defaultCalendarId) || calendars[0];
      if (!defaultCalendar) {
          // Create a temporary fallback calendar if none exists to ensure scheduling still runs
          defaultCalendar = {
              id: 'fallback-default',
              name: 'Standard (Fallback)',
              workingDays: [1, 2, 3, 4, 5],
              exceptions: []
          };
      }
      const hierarchicalTasks = updateHierarchyAndSort(tasks);
      return calculateSchedule(hierarchicalTasks, links, columns, defaultCalendar, assignments, resources, calendars);
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
      const { tasks, links, resources, assignments, calendars, baselines, projectColors, projectTextColors, projectCriticalPathColors } = action.payload;
      const defaultCalendarId = state.defaultCalendarId || calendars.find(c => c.name === "Standard")?.id || calendars[0]?.id || null;
      const scheduledTasks = runScheduler(tasks, links, state.columns, calendars, defaultCalendarId, assignments, resources);
      return {
        ...state,
        tasks: scheduledTasks,
        links,
        resources,
        assignments,
        calendars,
        baselines: baselines || [],
        defaultCalendarId,
        projectColors,
        projectTextColors,
        projectCriticalPathColors,
      };
    }
    case 'SET_PERSISTED_STATE': {
        const { views, sharedSettings, userPreferences, member } = action.payload;
        
        const finalUiDensity = userPreferences?.uiDensity || defaultUserPreferences.uiDensity;
        const finalGanttSettings = { ...initialGanttSettings, ...(userPreferences?.ganttSettings || {}) };
        const finalCurrentViewId = userPreferences?.currentViewId || defaultUserPreferences.currentViewId;
        const finalActiveStylePresetId = userPreferences?.activeStylePresetId === null ? null : (userPreferences?.activeStylePresetId || defaultUserPreferences.activeStylePresetId);

        const newViews = views.length > 0 ? views : defaultViews;
        const newSharedSettings = sharedSettings ? { ...defaultAppSettings, ...sharedSettings } : defaultAppSettings;
        const currentView = newViews.find(v => v.id === finalCurrentViewId) || newViews[0];

        // Prefer sharedSettings (app_settings) as it represents the live shared state.
        let finalVisibleColumns = newSharedSettings.visibleColumns && newSharedSettings.visibleColumns.length > 0
            ? newSharedSettings.visibleColumns
            : (currentView.visibleColumns || initialVisibleColumns);

        let finalGrouping = newSharedSettings.grouping || currentView.grouping || [];
        let finalFilters = newSharedSettings.filters || currentView.filters || [];

        if (member?.permissions?.hiddenColumns) {
            const hidden = member.permissions.hiddenColumns;
            finalVisibleColumns = finalVisibleColumns.filter(colId => !hidden.includes(colId));
        }

        const loadedStylePresets = newSharedSettings.stylePresets || defaultStylePresets;
        if (finalActiveStylePresetId) {
            const preset = loadedStylePresets.find(p => p.id === finalActiveStylePresetId);
            if (preset) {
                finalGanttSettings.theme = preset.settings.theme;
                finalGanttSettings.customStyles = preset.settings.customStyles || {};
            }
        }
        
        if (finalGanttSettings?.dateFormat) {
            try {
                format(new Date(), finalGanttSettings.dateFormat);
            } catch (e) {
                console.warn(`Invalid date format string "${finalGanttSettings.dateFormat}" found in settings. Resetting to default.`);
                finalGanttSettings.dateFormat = defaultUserPreferences.ganttSettings.dateFormat;
            }
        }

        const tempStateForDirtyCheck: ProjectState = {
            ...state,
            views: newViews,
            currentViewId: currentView.id,
            grouping: finalGrouping,
            visibleColumns: finalVisibleColumns,
            filters: finalFilters,
        };
        
        let finalColumns = newSharedSettings.columns || initialColumns;
        // Ensure new system columns (like 'calendar') appear in existing projects
        const existingColIds = new Set(finalColumns.map(c => c.id));
        const missingColumns = initialColumns.filter(c => !existingColIds.has(c.id));
        if (missingColumns.length > 0) {
            finalColumns = [...finalColumns, ...missingColumns];
        }

        return {
            ...state,
            views: newViews,
            columns: finalColumns,
            uiDensity: finalUiDensity,
            ganttSettings: finalGanttSettings,
            stylePresets: loadedStylePresets,
            activeStylePresetId: finalActiveStylePresetId,
            currentViewId: currentView.id,
            grouping: finalGrouping,
            visibleColumns: finalVisibleColumns,
            filters: finalFilters,
            isDirty: checkDirty(tempStateForDirtyCheck),
        };
    }
    case 'UPDATE_TASK': {
        const { id, ...update } = action.payload;

        let newUpdate = { ...update };
        const existingTask = state.tasks.find(t => t.id === id);

        // If we are updating work and it's effort driven, recalculate duration
        if (existingTask && 'work' in update) {
             const isEffortDriven = (update.schedulingType || existingTask.schedulingType) === 'effort';
             if (isEffortDriven) {
                 const newWork = update.work || 0;
                 // Get assignments for this task to calculate total units
                 const taskAssignments = state.assignments.filter(a => a.taskId === id);
                 const totalUnits = taskAssignments.reduce((sum, a) => sum + (a.units || 0), 0);
                 const effectiveUnits = totalUnits > 0 ? totalUnits : 1;

                 // Duration (days) = Work (hours) / (Units * 8 hours/day)
                 const newDuration = newWork / (effectiveUnits * 8);
                 newUpdate.duration = newDuration;
             }
        }

        let requiresReschedule = false;
        if (
            'start' in newUpdate ||
            'finish' in newUpdate ||
            'duration' in newUpdate ||
            'constraintType' in newUpdate ||
            'constraintDate' in newUpdate
        ) {
            requiresReschedule = true;
        }

        const updatedTasks = state.tasks.map(t =>
            t.id === id ? { ...t, ...newUpdate } : t
        );
        
        // If an update doesn't affect the schedule, we can skip the expensive reschedule
        const finalTasks = requiresReschedule 
            ? runScheduler(updatedTasks, state.links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources)
            : updateHierarchyAndSort(updatedTasks);

        return { ...state, tasks: finalTasks, isDirty: checkDirty({ ...state, tasks: finalTasks }) };
    }
    case 'UPDATE_LINK': {
        const newLinks = state.links.map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l);
        const reScheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { ...state, links: newLinks, tasks: reScheduledTasks };
    }
    case 'UPDATE_RESOURCE': {
        const newResources = state.resources.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r);
        return { ...state, resources: newResources };
    }
    case 'ADD_RESOURCE': {
        const { id, name, initials } = action.payload || {};
        const maxOrder = state.resources.length > 0 ? Math.max(...state.resources.map(r => r.order ?? 0)) : -1;
        const newResource: Resource = {
            id: id || `res-${Date.now()}`,
            name: name || 'New Resource',
            type: 'Work',
            availability: 1,
            costPerHour: 0,
            order: maxOrder + 1,
        };
        if (initials !== undefined) {
            newResource.initials = initials;
        }
        const newResources = [...state.resources, newResource];
        return { ...state, resources: newResources };
    }
    case 'REORDER_RESOURCE': {
        const { sourceId, targetId, position } = action.payload;
        const resources = [...state.resources].sort((a, b) => (a.order || 0) - (b.order || 0));

        const sourceIndex = resources.findIndex(r => r.id === sourceId);
        const targetIndex = resources.findIndex(r => r.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) return state;

        const [movedResource] = resources.splice(sourceIndex, 1);
        const adjustedTargetIndex = resources.findIndex(r => r.id === targetId); // Re-find index after splice

        const targetResource = resources[adjustedTargetIndex];
        const effectiveTargetOrder = targetResource.order ?? adjustedTargetIndex;

        // Calculate new order
        let newOrder: number;
        if (position === 'top') {
            const prevResource = resources[adjustedTargetIndex - 1];
            const orderBefore = prevResource ? (prevResource.order ?? (adjustedTargetIndex - 1)) : effectiveTargetOrder - 1;
            newOrder = (orderBefore + effectiveTargetOrder) / 2;
             resources.splice(adjustedTargetIndex, 0, movedResource);
        } else {
            const nextResource = resources[adjustedTargetIndex + 1];
            const orderAfter = nextResource ? (nextResource.order ?? (adjustedTargetIndex + 1)) : effectiveTargetOrder + 1;
            newOrder = (effectiveTargetOrder + orderAfter) / 2;
            resources.splice(adjustedTargetIndex + 1, 0, movedResource);
        }

        movedResource.order = newOrder;

        return { ...state, resources };
    }
    case 'REMOVE_RESOURCE': {
        const { resourceId } = action.payload;
        const newResources = state.resources.filter(r => r.id !== resourceId);
        const newAssignments = state.assignments.filter(a => a.resourceId !== resourceId);
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, state.calendars, state.defaultCalendarId, newAssignments, newResources);
        return { ...state, resources: newResources, assignments: newAssignments, tasks: reScheduledTasks };
    }
    case 'ADD_ASSIGNMENT': {
        const { taskId, resourceId, units } = action.payload;
        const newAssignment: Assignment = {
            id: `assignment-${crypto.randomUUID()}`,
            taskId,
            resourceId,
            units: units ?? 1,
        };
        const newAssignments = [...state.assignments, newAssignment];
        return { ...state, assignments: newAssignments };
    }
    case 'UPDATE_ASSIGNMENT': {
        const { id, units } = action.payload;
        const newAssignments = state.assignments.map(a => a.id === id ? { ...a, units } : a);
        return { ...state, assignments: newAssignments };
    }
    case 'REMOVE_ASSIGNMENT': {
        const { id } = action.payload;
        const newAssignments = state.assignments.filter(a => a.id !== id);
        return { ...state, assignments: newAssignments };
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
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, state.defaultCalendarId, state.assignments, state.resources);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks, isDirty: checkDirty({ ...state, calendars: newCalendars }) };
    }
     case 'REMOVE_CALENDAR': {
        const { calendarId } = action.payload;
        if (state.calendars.length <= 1) return state;
        const newCalendars = state.calendars.filter(c => c.id !== calendarId);
        const newDefaultCalendarId = state.defaultCalendarId === calendarId ? newCalendars[0].id : state.defaultCalendarId;
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, newDefaultCalendarId, state.assignments, state.resources);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks, defaultCalendarId: newDefaultCalendarId };
    }
    case 'ADD_NOTE_TO_TASK': {
        const { taskId, content, userId, author } = action.payload;
        const newNote: Note = {
            id: `note-${Date.now()}`,
            author: author || 'User',
            userId: userId,
            content,
            timestamp: new Date(),
        };
        const updatedTasks = state.tasks.map(t =>
            t.id === taskId ? { ...t, notes: [...(t.notes || []), newNote] } : t
        );
        return { ...state, tasks: updatedTasks };
    }
    case 'UPDATE_NOTE': {
        const { taskId, noteId, content } = action.payload;
        const updatedTasks = state.tasks.map(t => {
            if (t.id === taskId && t.notes) {
                return {
                    ...t,
                    notes: t.notes.map(n => n.id === noteId ? { ...n, content } : n)
                };
            }
            return t;
        });
        return { ...state, tasks: updatedTasks };
    }
    case 'DELETE_NOTE': {
        const { taskId, noteId } = action.payload;
        const updatedTasks = state.tasks.map(t => {
            if (t.id === taskId && t.notes) {
                return {
                    ...t,
                    notes: t.notes.filter(n => n.id !== noteId)
                };
            }
            return t;
        });
        return { ...state, tasks: updatedTasks };
    }
    case 'SET_ROW_SELECTION': {
        const { taskId, shiftKey, ctrlKey } = action.payload;
        const visibleTasks = getVisibleTasks(state.tasks);
        // If we are switching from cell mode, the anchor is null.
        const anchorId = state.selectionMode === 'row' ? (state.selectionAnchor || state.selectedTaskIds[0] || null) : taskId;

        let newSelectedIds = [taskId];
        let newAnchorId = taskId;

        if (shiftKey && anchorId) {
            const anchorIndex = visibleTasks.findIndex(t => t.id === anchorId);
            const currentIndex = visibleTasks.findIndex(t => t.id === taskId);
            if (anchorIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(anchorIndex, currentIndex);
                const end = Math.max(anchorIndex, currentIndex);
                newSelectedIds = visibleTasks.slice(start, end + 1).map(t => t.id);
                newAnchorId = anchorId; // Keep original anchor
            }
        } else if (ctrlKey || state.multiSelectMode) {
            const currentSelection = state.selectionMode === 'row' ? [...state.selectedTaskIds] : [];
            const existingIndex = currentSelection.indexOf(taskId);
            if (existingIndex > -1) {
                currentSelection.splice(existingIndex, 1);
            } else {
                currentSelection.push(taskId);
            }
            newSelectedIds = currentSelection;
            newAnchorId = taskId;
        }
        
        return {
            ...state,
            selectionMode: 'row',
            selectedTaskIds: newSelectedIds,
            selectionAnchor: newAnchorId,
            focusCell: null,
            anchorCell: null,
            editingCell: null,
        };
    }
    case 'SET_CELL_SELECTION': {
        const { taskId, columnId, shiftKey, ctrlKey } = action.payload;
        const newFocusCell = { taskId, columnId };
        
        let newSelectedTaskIds = state.selectedTaskIds;
        let newAnchorCell = state.anchorCell;

        if (ctrlKey || state.multiSelectMode) {
             if (newSelectedTaskIds.includes(taskId)) {
                 newSelectedTaskIds = newSelectedTaskIds.filter(id => id !== taskId);
             } else {
                 newSelectedTaskIds = [...newSelectedTaskIds, taskId];
            }
            newAnchorCell = newFocusCell;
        } else if (shiftKey) {
             newAnchorCell = (!shiftKey || state.selectionMode !== 'cell')
                ? newFocusCell
                : state.anchorCell || state.focusCell || newFocusCell;
             // Keep existing selectedTaskIds during range selection extension?
             // Or clear? Standard behavior usually implies extending active selection.
             // For now, we preserve them.
        } else {
             newSelectedTaskIds = [taskId];
             newAnchorCell = newFocusCell;
        }

        return {
            ...state,
            selectionMode: 'cell',
            focusCell: newFocusCell,
            anchorCell: newAnchorCell,
            selectedTaskIds: newSelectedTaskIds,
            selectionAnchor: null,
            editingCell: null,
        };
    }
    case 'TOGGLE_TASK_COLLAPSE': {
      const newTasks = state.tasks.map(task => 
        task.id === action.payload.taskId ? { ...task, isCollapsed: !task.isCollapsed } : task
      );
      return { ...state, tasks: newTasks };
    }
    case 'TOGGLE_GROUP': {
        const { groupId } = action.payload;
        const { overrides } = state.groupingState;
        const newOverrides = overrides.includes(groupId)
            ? overrides.filter(id => id !== groupId)
            : [...overrides, groupId];

        return {
            ...state,
            groupingState: {
                ...state.groupingState,
                overrides: newOverrides
            }
        };
    }
    case 'COLLAPSE_ALL': {
        if (state.grouping.length > 0) {
             return { ...state, groupingState: { mode: 'collapsed', overrides: [] } };
        }

        const taskIdsInSelection = getTaskIdsInSelection(state);
        const restrictToSelection = taskIdsInSelection.size >= 2;

        const candidateTasks = restrictToSelection
            ? state.tasks.filter(t => taskIdsInSelection.has(t.id))
            : state.tasks;

        const expandedSummaries = candidateTasks.filter(t => t.isSummary && !t.isCollapsed);

        if (expandedSummaries.length === 0) {
            return state;
        }

        const maxLevel = Math.max(...expandedSummaries.map(t => t.level || 0));

        const newTasks = state.tasks.map(task => {
            if (task.isSummary && !task.isCollapsed && (task.level || 0) === maxLevel) {
                 if (!restrictToSelection || taskIdsInSelection.has(task.id)) {
                     return { ...task, isCollapsed: true };
                 }
            }
            return task;
        });

        return { ...state, tasks: newTasks };
    }
    case 'EXPAND_ALL': {
        if (state.grouping.length > 0) {
             return { ...state, groupingState: { mode: 'expanded', overrides: [] } };
        }

        const taskIdsInSelection = getTaskIdsInSelection(state);
        const restrictToSelection = taskIdsInSelection.size >= 2;

        const candidateTasks = restrictToSelection
            ? state.tasks.filter(t => taskIdsInSelection.has(t.id))
            : state.tasks;

        const collapsedSummaries = candidateTasks.filter(t => t.isSummary && t.isCollapsed);

        if (collapsedSummaries.length === 0) {
            return state;
        }

        const minLevel = Math.min(...collapsedSummaries.map(t => t.level || 0));

        const newTasks = state.tasks.map(task => {
            if (task.isSummary && task.isCollapsed && (task.level || 0) === minLevel) {
                 if (!restrictToSelection || taskIdsInSelection.has(task.id)) {
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
        const reScheduledTasks = runScheduler(state.tasks, state.links, newColumns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
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
    case 'SET_MULTI_SELECT_MODE': {
      return { ...state, multiSelectMode: action.payload };
    }
    case 'ADD_TASKS_FROM_PASTE': {
        const { data, activeCell, projectId } = action.payload;
        try {
            const parsedData = JSON.parse(data);
            if (parsedData.type === 'omniplan-tasks' && Array.isArray(parsedData.tasks)) {
                const pastedTasks: Task[] = parsedData.tasks;
                const pastedLinks: Link[] = parsedData.links || [];
                if (pastedTasks.length === 0) return state;

                const idMap = new Map<string, string>();
                pastedTasks.forEach(t => idMap.set(t.id, `task-${Date.now()}-${Math.random()}`.replace('.','')));
                
                let targetIndex = state.tasks.length;
                let inheritedProjectId = projectId;

                if (activeCell) {
                    const activeTaskIndex = state.tasks.findIndex(t => t.id === activeCell.taskId);
                    if (activeTaskIndex !== -1) {
                        targetIndex = activeTaskIndex + 1;
                        inheritedProjectId = state.tasks[activeTaskIndex].projectId || projectId;
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
                        projectId: inheritedProjectId,
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
                
                const rawNewLinks: Link[] = pastedLinks.map(link => ({
                    ...link,
                    id: `link-${Date.now()}-${Math.random()}`.replace('.', ''),
                    source: idMap.get(link.source)!,
                    target: idMap.get(link.target)!,
                    sourceProjectId: inheritedProjectId,
                    targetProjectId: inheritedProjectId,
                }));

                // Deduplicate new links internally
                const uniqueNewLinksMap = new Map<string, Link>();
                rawNewLinks.forEach(l => uniqueNewLinksMap.set(`${l.source}-${l.target}`, l));

                // Deduplicate against existing links
                const existingKeys = new Set(state.links.map(l => `${l.source}-${l.target}`));
                const finalNewLinks = Array.from(uniqueNewLinksMap.values()).filter(l => !existingKeys.has(`${l.source}-${l.target}`));
                
                const allTasks = [...state.tasks];
                allTasks.splice(targetIndex, 0, ...newTasks);
                
                const allLinks = [...state.links, ...finalNewLinks];
                
                const scheduledTasks = runScheduler(allTasks, allLinks, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
                const newSelectedIds = newTasks.map(t => t.id);

                return { ...state, tasks: scheduledTasks, links: allLinks, selectedTaskIds: newSelectedIds };
            }
        } catch (e) {
            // Not JSON, fall through to plain text handling
        }

        // Plain text handling
        const lines = data.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return state;
        
        if (lines.length > 1) {
            let targetIndex = state.tasks.length;
            let inheritedProjectId = projectId;

            if (activeCell) {
                const activeTaskIndex = state.tasks.findIndex(t => t.id === activeCell.taskId);
                if (activeTaskIndex > -1) {
                    targetIndex = activeTaskIndex + 1;
                    inheritedProjectId = state.tasks[activeTaskIndex].projectId || projectId;
                }
            }
            
            const orderBefore = state.tasks[targetIndex - 1]?.order ?? (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.order ?? 0)) : -1);
            const orderAfter = state.tasks[targetIndex]?.order ?? orderBefore + lines.length + 1;
            const orderStep = (orderAfter - orderBefore) / (lines.length + 1);

            const newTasks: Task[] = lines.map((line, index) => ({
                id: `task-${Date.now()}-${index}`,
                projectId: inheritedProjectId,
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
            
            const scheduledTasks = runScheduler(allTasks, state.links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
            const newSelectedIds = newTasks.map(t => t.id);
            
            return { ...state, tasks: scheduledTasks, selectedTaskIds: newSelectedIds };

        } else if (lines.length === 1 && activeCell) {
            const { taskId, columnId } = activeCell;
            const value = lines[0].trim();
            
            if (columnId === 'predecessors' || columnId === 'successors') {
                 return projectReducer(state, { type: 'UPDATE_RELATIONSHIPS', payload: { taskId, field: columnId, value } });
            }
            if (columnId === 'duration') {
                const task = state.tasks.find(t => t.id === taskId);
                const parsed = parseDuration(value, task?.durationUnit);
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
    case 'START_EDITING_CELL': {
      return { ...state, focusCell: action.payload, editingCell: action.payload };
    }
    case 'STOP_EDITING_CELL': {
      return { ...state, editingCell: null };
    }
    case 'UPDATE_GANTT_SETTINGS': {
      const presets = state.stylePresets || defaultStylePresets;
      const activePreset = presets.find(p => p.id === state.activeStylePresetId);
      
      let newActiveStylePresetId = state.activeStylePresetId;
      if (activePreset) {
          const presetSettings = activePreset.settings;
          const currentSettings = action.payload;
          const customStylesMatch = JSON.stringify(presetSettings.customStyles || {}) === JSON.stringify(currentSettings.customStyles || {});
          const themeMatch = presetSettings.theme === currentSettings.theme;
          if (!customStylesMatch || !themeMatch) {
              newActiveStylePresetId = null;
          }
      } else {
        newActiveStylePresetId = null;
      }
      
      const newState = {
          ...state,
          ganttSettings: action.payload,
          stylePresets: presets,
          activeStylePresetId: newActiveStylePresetId,
      };

      const baselineColumns = ['baselineDuration', 'baselineStart', 'baselineFinish', 'finishVariance'];
      const wasShowingBaseline = !!state.ganttSettings.comparisonBaselineId;
      const isShowingBaseline = !!action.payload.comparisonBaselineId;

      if (isShowingBaseline && !wasShowingBaseline) {
        const columnsToAdd = baselineColumns.filter(bc => !newState.visibleColumns.includes(bc));
        newState.visibleColumns = [...newState.visibleColumns, ...columnsToAdd];
      } else if (!isShowingBaseline && wasShowingBaseline) {
        newState.visibleColumns = newState.visibleColumns.filter(vc => !baselineColumns.includes(vc));
      }

      return { ...newState, isDirty: checkDirty(newState) };
    }
    case 'SET_STYLE_PRESETS': {
        return { ...state, stylePresets: action.payload };
    }
    case 'SET_ACTIVE_STYLE_PRESET': {
        const { id } = action.payload;
        const preset = state.stylePresets.find(p => p.id === id);
        if (preset) {
            const newGanttSettings = {
                ...state.ganttSettings,
                theme: preset.settings.theme,
                customStyles: preset.settings.customStyles || {},
            };
            return { ...state, activeStylePresetId: id, ganttSettings: newGanttSettings };
        }
        return state;
    }
    case 'ADD_BASELINE': {
        const { name } = action.payload;
        const baselineTasks = state.tasks.map(t => toFirestoreTask(t) as Task);
        const newBaseline: Baseline = {
            id: `baseline-${Date.now()}`,
            name,
            createdAt: new Date(),
            tasks: baselineTasks,
        };
        return { ...state, baselines: [...state.baselines, newBaseline] };
    }
    case 'DELETE_BASELINE': {
        const { baselineId } = action.payload;
        const newBaselines = state.baselines.filter(b => b.id !== baselineId);
        let newGanttSettings = state.ganttSettings;
        if (state.ganttSettings.comparisonBaselineId === baselineId) {
            newGanttSettings = { ...state.ganttSettings, comparisonBaselineId: null };
        }
        return { ...state, baselines: newBaselines, ganttSettings: newGanttSettings };
    }
    case 'LOAD_PROJECT': {
        const loaded = action.payload;
        const ganttSettings = { ...initialProjectState.ganttSettings, ...(loaded.ganttSettings || {}) };
        const stylePresets = loaded.stylePresets?.length ? loaded.stylePresets : defaultStylePresets;
        
        const loadedState = { 
            ...initialProjectState,
            ...loaded,
            ganttSettings: ganttSettings,
            stylePresets: stylePresets,
            groupingState: loaded.groupingState || initialProjectState.groupingState,
        };
        const scheduledTasks = runScheduler(loadedState.tasks, loadedState.links, loadedState.columns, loadedState.calendars, loadedState.defaultCalendarId, loadedState.assignments, loadedState.resources);
        return {
            ...loadedState,
            tasks: scheduledTasks,
            isDirty: false
        };
    }
    case 'ADD_TASK': {
        const newId = action.payload?.id || `task-${Date.now()}`;
        const projectIdFromPayload = action.payload?.projectId;
        const { tasks, focusCell } = state;
        const lastSelectedId = focusCell?.taskId || (state.selectedTaskIds.length > 0 ? state.selectedTaskIds[state.selectedTaskIds.length - 1] : null);

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
            projectId: projectIdFromPayload,
        };

        if (lastSelectedId) {
            const selectedTask = tasks.find(t => t.id === lastSelectedId);
            if (selectedTask) {
                 newTask.projectId = selectedTask.projectId;
                 newTask.parentId = selectedTask.parentId;
            }
        }
        
        let newTasks = [...state.tasks];
        if (lastSelectedId) {
            const selectedIndex = newTasks.findIndex(t => t.id === lastSelectedId);
            newTasks.splice(selectedIndex + 1, 0, ...[newTask]);
        } else {
            newTasks.push(newTask);
        }
        
        const scheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { 
            ...state, 
            tasks: scheduledTasks, 
            selectionMode: 'cell',
            focusCell: { taskId: newTask.id, columnId: 'name' },
            anchorCell: { taskId: newTask.id, columnId: 'name' },
            selectedTaskIds: [],
            selectionAnchor: null,
            editingCell: null,
        };
    }
    case 'REMOVE_TASK': {
        const idsToRemove = getTaskIdsInSelection(state);
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
        
        const scheduledTasks = runScheduler(newTasks, newLinks, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { 
            ...state, 
            tasks: scheduledTasks, 
            links: newLinks, 
            selectedTaskIds: [],
            selectionAnchor: null,
            focusCell: null,
            anchorCell: null,
            editingCell: null,
         };
    }
    case 'LINK_TASKS': {
        const taskIdsToLink = Array.from(getTaskIdsInSelection(state));
        if (taskIdsToLink.length < 2) return state;
        
        const existingLinkPairs = new Set(state.links.map(l => `${l.source}-${l.target}`));
        const visibleTasks = getVisibleTasks(state.tasks);
        const selectedVisibleTasks = visibleTasks.filter(t => taskIdsToLink.includes(t.id));

        if (selectedVisibleTasks.length < 2) return state;
        
        const newLinks: Link[] = [];

        for (let i = 0; i < selectedVisibleTasks.length - 1; i++) {
            const sourceTask = selectedVisibleTasks[i];
            const targetTask = selectedVisibleTasks[i + 1];
            const source = sourceTask.id;
            const target = targetTask.id;
            const linkKey = `${source}-${target}`;

            if (!existingLinkPairs.has(linkKey)) {
                newLinks.push({
                    id: crypto.randomUUID(),
                    source: source,
                    target: target,
                    type: 'FS',
                    lag: 0,
                    sourceProjectId: sourceTask.projectId,
                    targetProjectId: targetTask.projectId,
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
        const scheduledTasks = runScheduler(state.tasks, allLinks, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { ...state, links: allLinks, tasks: scheduledTasks };
    }
    case 'ADD_LINK': {
        const { source, target } = action.payload;

        const existingLink = state.links.find(l => l.source === source && l.target === target);
        if (existingLink) {
             return {
                ...state,
                notifications: [
                    ...state.notifications,
                    {
                        id: `toast-duplicate-link-${Date.now()}`,
                        type: 'toast',
                        title: "Link Already Exists",
                        description: "A dependency between these tasks already exists."
                    }
                ]
            };
        }

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

        const sourceTask = state.tasks.find(t => t.id === source);
        const targetTask = state.tasks.find(t => t.id === target);

        const newLink: Link = {
            id: crypto.randomUUID(),
            source: action.payload.source,
            target: action.payload.target,
            type: action.payload.type,
            lag: action.payload.lag,
            sourceProjectId: sourceTask?.projectId,
            targetProjectId: targetTask?.projectId,
        };
        const newLinks = [...state.links, newLink];
        const scheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { ...state, links: newLinks, tasks: scheduledTasks };
    }
    case 'REMOVE_LINK': {
        const { linkId } = action.payload;
        const newLinks = state.links.filter(l => l.id !== linkId);
        const scheduledTasks = runScheduler(state.tasks, newLinks, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { ...state, links: newLinks, tasks: scheduledTasks };
    }
    
    case 'UPDATE_RELATIONSHIPS': {
        const { taskId, field, value } = action.payload;
        const { tasks, links, columns, calendars, defaultCalendarId } = state;
        const wbsToIdMap = new Map(tasks.filter(t => t.wbs).map(t => [t.wbs!, t.id]));
        const displayWbsToIdMap = new Map(tasks.filter(t => t.wbs).map(t => {
             const prefix = t.projectInitials ? `${t.projectInitials}-` : '';
             return [`${prefix}${t.wbs}`, t.id];
        }));
        const idToWbsMap = new Map(tasks.map(t => [t.id, t.wbs || '']));

        const existingLinks = links.filter(l => (field === 'predecessors' ? l.target : l.source) === taskId);
        const existingRelations = new Set(existingLinks.map(l => {
            const relatedTaskWbs = idToWbsMap.get(field === 'predecessors' ? l.source : l.target) || '';
            let lagString = '';
            if (l.lag > 0) lagString = `+${l.lag}d`;
            if (l.lag < 0) lagString = `${l.lag}d`;
            return `${relatedTaskWbs}${l.type}${lagString}`;
        }));
        
        const linkParseRegex = /^([A-Za-z0-9.-]+?)(FS|SS|FF|SF)?([+-]\d+d)?$/i;
        const newRelationsStrings = value.split(',').map(s => s.trim()).filter(Boolean);

        // Deduplicate strings based on WBS (target/source task) to enforce one link per pair.
        const uniqueRelationsMap = new Map<string, string>();
        for (const rel of newRelationsStrings) {
            const match = rel.match(linkParseRegex);
            if (match) {
                const wbs = match[1];
                uniqueRelationsMap.set(wbs, rel); // Last one wins
            }
        }
        const newRelationsSet = new Set(uniqueRelationsMap.values());
        
        const relationsToRemove = [...existingRelations].filter(r => !newRelationsSet.has(r));
        const relationsToAdd = [...newRelationsSet].filter(r => !existingRelations.has(r));

        for (const rel of relationsToAdd) {
            const match = rel.match(linkParseRegex);
            if (!match) continue; 
            const wbs = match[1];
            const relatedTaskId = wbsToIdMap.get(wbs) || displayWbsToIdMap.get(wbs);
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

        const newLinkObjects: Link[] = relationsToAdd.map((rel): Link | null => {
            const match = rel.match(linkParseRegex);
            if (!match) return null;
            
            const wbs = match[1];
            const type = (match[2] || 'FS').toUpperCase() as LinkType;
            const lagStr = match[3];
            const lag = lagStr ? parseInt(lagStr) : 0;
            const relatedTaskId = wbsToIdMap.get(wbs) || displayWbsToIdMap.get(wbs);

            if (relatedTaskId && relatedTaskId !== taskId) {
                const source = field === 'predecessors' ? relatedTaskId : taskId;
                const target = field === 'predecessors' ? taskId : relatedTaskId;

                const sourceTask = state.tasks.find(t => t.id === source);
                const targetTask = state.tasks.find(t => t.id === target);

                return {
                    id: crypto.randomUUID(),
                    source: source,
                    target: target,
                    type,
                    lag,
                    sourceProjectId: sourceTask?.projectId,
                    targetProjectId: targetTask?.projectId,
                };
            }
            return null;
        }).filter((l): l is Link => l !== null);
        
        const finalLinks = [
            ...links.filter(l => !linksToRemove.some(r => r.id === l.id)),
            ...newLinkObjects
        ];
        
        const newTasks = runScheduler(tasks, finalLinks, columns, calendars, defaultCalendarId, state.assignments, state.resources);
        return { ...state, links: finalLinks, tasks: newTasks };
    }
    case 'INDENT_TASK': {
        const tasksToIndent = Array.from(getTaskIdsInSelection(state));
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
        const scheduledTasks = runScheduler(updatedTasks, newLinks, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        
        return { ...state, tasks: scheduledTasks, links: newLinks, notifications };
    }
    case 'OUTDENT_TASK': {
        const taskIdsToOutdent = Array.from(getTaskIdsInSelection(state));
        if (taskIdsToOutdent.length === 0) return state;

        const tasks = [...state.tasks];
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const sortedSelectedIds = tasks
            .filter(t => taskIdsToOutdent.includes(t.id))
            .map(t => t.id);
            
        for (const taskId of sortedSelectedIds) {
            const taskToOutdent = taskMap.get(taskId)!;
            if (taskToOutdent.parentId) {
                const parent = taskMap.get(taskToOutdent.parentId);
                taskToOutdent.parentId = parent?.parentId || null;
            }
        }

        const scheduledTasks = runScheduler(Array.from(taskMap.values()), state.links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { ...state, tasks: scheduledTasks };
    }
    case 'REORDER_TASKS': {
        const { sourceIds, targetId, position } = action.payload;
        
        let tasks = [...state.tasks];
        const targetIndex = tasks.findIndex(t => t.id === targetId);
        if (targetIndex === -1) return state;
        
        let sourceTasks: Task[];
        // Use a Map for O(1) lookup when reordering many tasks to avoid O(N*M) complexity
        if (sourceIds.length < 50) {
             sourceTasks = sourceIds.map(id => tasks.find(t => t.id === id)).filter((t): t is Task => !!t);
        } else {
             const taskMap = new Map(tasks.map(t => [t.id, t] as [string, Task]));
             sourceTasks = sourceIds.map(id => taskMap.get(id)).filter((t): t is Task => !!t);
        }

        const sourceOrders = sourceTasks.map(t => t.order || 0);

        // Use Set for O(1) lookup during filter
        const sourceIdSet = new Set(sourceIds);
        tasks = tasks.filter(t => !sourceIdSet.has(t.id));

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
        
        const scheduledTasks = runScheduler(finalTasks, state.links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
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
        const scheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
        return { ...state, tasks: scheduledTasks };
    }
    case 'CLEAR_NOTIFICATIONS': {
        return { ...state, notifications: [] };
    }
    case 'SET_REPRESENTATION': {
        return { ...state, currentRepresentation: action.payload };
    }
    case 'SORT_TASKS': {
        const { columnId } = action.payload;
        if (state.sortColumn === columnId) {
            if (state.sortDirection === 'asc') {
                return { ...state, sortDirection: 'desc' };
            } else if (state.sortDirection === 'desc') {
                return { ...state, sortColumn: null, sortDirection: null };
            }
        }
        return { ...state, sortColumn: columnId, sortDirection: 'asc' };
    }
    case 'LOAD_PROJECT_DATA': {
      const { tasks, links, resources, assignments } = action.payload;
      const scheduledTasks = runScheduler(tasks, links, state.columns, state.calendars, state.defaultCalendarId, assignments, resources);
      return {
        ...state,
        tasks: scheduledTasks,
        links,
        resources,
        assignments,
      };
    }
    case 'SYNC_TASKS': {
      const tasks = action.payload;
      const scheduledTasks = runScheduler(tasks, state.links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
      return { ...state, tasks: scheduledTasks };
    }
    case 'SYNC_LINKS': {
      const links = action.payload;
      const scheduledTasks = runScheduler(state.tasks, links, state.columns, state.calendars, state.defaultCalendarId, state.assignments, state.resources);
      return { ...state, links, tasks: scheduledTasks };
    }
    case 'UPDATE_SELECTION': {
      const { mode, taskId } = action.payload;
      return {
        ...state,
        selectionMode: mode,
        selectedTaskIds: taskId ? [taskId] : [],
        selectionAnchor: taskId,
      };
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
    present: initialProjectState,
    future: [],
}

// Higher-order reducer for history
const undoable = (reducer: (state: ProjectState, action: Action) => ProjectState) => {
    return (state: HistoryState, action: Action): HistoryState => {
        const { past, present, future } = state;
        
        const nonHistoricActions: Action['type'][] = [
            'SET_PROJECT_DATA',
            'SET_PERSISTED_STATE',
            'LOAD_PROJECT_DATA',
            'SYNC_TASKS',
            'SYNC_LINKS',
            'SET_ROW_SELECTION',
            'SET_CELL_SELECTION',
            'START_EDITING_CELL',
            'STOP_EDITING_CELL',
            'CLEAR_NOTIFICATIONS',
            'TOGGLE_GROUP',
            'SORT_TASKS',
            'COLLAPSE_ALL',
            'EXPAND_ALL',
            'UPDATE_CURRENT_VIEW',
            'SET_VIEW',
            'SET_UI_DENSITY',
            'SET_REPRESENTATION',
            'MOVE_SELECTION',
            'SET_MULTI_SELECT_MODE',
        ];

        if (action.type === '_APPLY_STATE_CHANGE') {
            const { newState, originalAction } = action.payload;
            if (originalAction.type === 'UNDO' || originalAction.type === 'REDO' || originalAction.type === 'JUMP_TO_HISTORY') {
                return { ...state, present: newState };
            }

            if (nonHistoricActions.includes(originalAction.type)) {
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
                    present: newPast.length > 0 ? newPast[newPast.length-1].state : initialProjectState,
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
  const [viewingSnapshotId, setViewingSnapshotId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<ProjectState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();
  const historyStateRef = useRef(historyState);
  const { isAdmin } = useIsAdmin(user);

  // Track whether initial load has completed (to avoid overwriting local edits)
  const initialLoadDoneRef = useRef(false);

  // Pending task updates map for debounced writes
  const pendingTaskUpdates = useRef<Map<string, any>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
      historyStateRef.current = historyState;
  }, [historyState]);

  // ─── Load project data on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    initialLoadDoneRef.current = false;
    setIsLoaded(false);

    Promise.all([
      projectApi.listTasks(projectId),
      projectApi.listLinks(projectId),
      projectApi.listResources(projectId),
      projectApi.listAssignments(projectId),
    ]).then(([tasks, links, resources, assignments]) => {
      if (cancelled) return;
      internalDispatch({
        type: 'LOAD_PROJECT_DATA',
        payload: { tasks, links, resources, assignments },
      });
      initialLoadDoneRef.current = true;
      setIsLoaded(true);
    }).catch(err => {
      console.error('Failed to load project data:', err);
      setIsLoaded(true); // Allow UI to render even on error
    });

    return () => { cancelled = true; };
  }, [projectId]);

  // ─── Debounced task update flush ─────────────────────────────────────────────
  const schedulePersist = useCallback((taskId: string, data: any) => {
    if (!projectId) return;
    pendingTaskUpdates.current.set(taskId, data);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      pendingTaskUpdates.current.forEach((updates, id) => {
        projectApi.updateTask(projectId, id, updates).catch(console.error);
      });
      pendingTaskUpdates.current.clear();
    }, 500);
  }, [projectId]);

  const isEditorOrOwner = useMemo(() => isAdmin, [isAdmin]);

  // ─── Dispatch wrapper — intercepts mutations for API persistence ──────────────
  const dispatch = useCallback((action: Action) => {
    if (action.type === 'UNDO' || action.type === 'REDO' || action.type === 'JUMP_TO_HISTORY') {
        internalDispatch(action);
        return;
    }

    // Apply reducer locally first
    internalDispatch(action);

    // Skip persistence if no project is loaded yet
    if (!projectId || !initialLoadDoneRef.current) return;

    // ── Task mutations ──
    if (action.type === 'UPDATE_TASK') {
      const { id, ...updates } = action.payload;
      schedulePersist(id, updates);
    } else if (action.type === 'ADD_TASK') {
      // The reducer generates a new task — we need the state after the dispatch.
      // We schedule an API create call; use a microtask so the reducer has applied.
      const newId = action.payload?.id || null;
      Promise.resolve().then(() => {
        const currentState = historyStateRef.current.present;
        const newTask = newId
          ? currentState.tasks.find(t => t.id === newId)
          : currentState.tasks[currentState.tasks.length - 1];
        if (newTask) {
          projectApi.createTask(projectId, newTask).catch(console.error);
        }
      });
    } else if (action.type === 'REMOVE_TASK') {
      // Capture tasks to remove before dispatch has wiped them from state
      const currentState = historyStateRef.current.present;
      const idsToRemove = new Set<string>();
      const taskIdsInSelection = (() => {
        const s = currentState;
        const ids = new Set(s.selectedTaskIds);
        if (s.selectionMode === 'cell' && s.anchorCell && s.focusCell) {
          const visibleTasks = currentState.tasks.filter(task => {
            if (!task.parentId) return true;
            const taskMap = new Map(s.tasks.map(t => [t.id, t]));
            let p = task.parentId ? taskMap.get(task.parentId) : undefined;
            while (p) {
              if (p.isCollapsed) return false;
              p = p.parentId ? taskMap.get(p.parentId) : undefined;
            }
            return true;
          });
          const r1 = visibleTasks.findIndex(t => t.id === s.anchorCell!.taskId);
          const r2 = visibleTasks.findIndex(t => t.id === s.focusCell!.taskId);
          if (r1 !== -1 && r2 !== -1) {
            const rowStart = Math.min(r1, r2);
            const rowEnd = Math.max(r1, r2);
            for (let i = rowStart; i <= rowEnd; i++) ids.add(visibleTasks[i].id);
          }
        }
        return ids;
      })();

      const findChildren = (parentId: string) => {
        currentState.tasks.forEach(t => {
          if (t.parentId === parentId) {
            idsToRemove.add(t.id);
            findChildren(t.id);
          }
        });
      };
      taskIdsInSelection.forEach(id => {
        idsToRemove.add(id);
        findChildren(id);
      });

      idsToRemove.forEach(id => {
        projectApi.deleteTask(projectId, id).catch(console.error);
      });
    }

    // ── Link mutations ──
    else if (action.type === 'ADD_LINK') {
      Promise.resolve().then(() => {
        const currentState = historyStateRef.current.present;
        const link = currentState.links.find(
          l => l.source === action.payload.source && l.target === action.payload.target
        );
        if (link) {
          projectApi.createLink(projectId, {
            sourceTaskId: link.source,
            targetTaskId: link.target,
            linkType: link.type,
            lag: link.lag,
            sourceProjectId: link.sourceProjectId,
            targetProjectId: link.targetProjectId,
          }).catch(console.error);
        }
      });
    } else if (action.type === 'LINK_TASKS') {
      Promise.resolve().then(() => {
        const prevLinks = historyStateRef.current.present.links;
        const currentState = historyStateRef.current.present;
        const newLinks = currentState.links.filter(
          l => !prevLinks.some(pl => pl.id === l.id)
        );
        newLinks.forEach(link => {
          projectApi.createLink(projectId, {
            sourceTaskId: link.source,
            targetTaskId: link.target,
            linkType: link.type,
            lag: link.lag,
            sourceProjectId: link.sourceProjectId,
            targetProjectId: link.targetProjectId,
          }).catch(console.error);
        });
      });
    } else if (action.type === 'REMOVE_LINK') {
      projectApi.deleteLink(projectId, action.payload.linkId).catch(console.error);
    }

    // ── Resource mutations ──
    else if (action.type === 'ADD_RESOURCE') {
      Promise.resolve().then(() => {
        const currentState = historyStateRef.current.present;
        const newId = action.payload?.id;
        const resource = newId
          ? currentState.resources.find(r => r.id === newId)
          : currentState.resources[currentState.resources.length - 1];
        if (resource) {
          projectApi.createResource(projectId, resource).catch(console.error);
        }
      });
    } else if (action.type === 'UPDATE_RESOURCE') {
      const { id, ...updates } = action.payload;
      projectApi.updateResource(projectId, { id, ...updates }).catch(console.error);
    } else if (action.type === 'REMOVE_RESOURCE') {
      projectApi.deleteResource(projectId, { id: action.payload.resourceId }).catch(console.error);
    }

    // ── Assignment mutations ──
    else if (action.type === 'ADD_ASSIGNMENT') {
      Promise.resolve().then(() => {
        const currentState = historyStateRef.current.present;
        const assignment = currentState.assignments.find(
          a => a.taskId === action.payload.taskId && a.resourceId === action.payload.resourceId
        );
        if (assignment) {
          projectApi.createAssignment(projectId, {
            taskId: assignment.taskId,
            resourceId: assignment.resourceId,
            units: assignment.units,
          }).catch(console.error);
        }
      });
    } else if (action.type === 'REMOVE_ASSIGNMENT') {
      projectApi.deleteAssignment(projectId, { id: action.payload.id }).catch(console.error);
    }
  }, [projectId, schedulePersist]);

  const saveSnapshot = useCallback(async (_name: string) => {
    // TODO(T5): implement via API
    toast({ variant: 'destructive', title: 'Not implemented', description: 'Snapshots not yet available.' });
  }, [toast]);

  const restoreSnapshot = useCallback((_snapshot: Snapshot) => {
    // TODO(T5): implement via API
    toast({ variant: 'destructive', title: 'Not implemented', description: 'Snapshots not yet available.' });
  }, [toast]);

  const deleteSnapshot = useCallback(async (_snapshotId: string) => {
    // TODO(T5): implement via API
    toast({ variant: 'destructive', title: 'Not implemented', description: 'Snapshots not yet available.' });
  }, [toast]);

  const previewSnapshot = useCallback((snapshot: Snapshot) => {
    try {
      const parsedState = JSON.parse(snapshot.data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          return new Date(value);
        }
        return value;
      });
      if (parsedState.tasks) {
        parsedState.tasks = parsedState.tasks.map(sanitizeRestoredTask);
      }
      setPreviewState(parsedState);
      setViewingSnapshotId(snapshot.id);
    } catch (e) {
      console.error("Error parsing snapshot for preview:", e);
      toast({ variant: "destructive", title: "Error", description: "Failed to preview snapshot." });
    }
  }, [toast]);

  const exitPreview = useCallback(() => {
    setViewingSnapshotId(null);
    setPreviewState(null);
  }, []);

  return {
    state: viewingSnapshotId && previewState ? previewState : historyState.present,
    dispatch,
    isLoaded,
    isEditorOrOwner,
    canUndo: historyState.past.length > 0,
    canRedo: historyState.future.length > 0,
    history: {
        log: historyState.past.map(h => ({
            actionType: h.action.type,
            payloadDescription: getPayloadDescription(h.action, historyState.present.tasks),
            timestamp: new Date()
        })),
        index: historyState.past.length - 1
    },
    persistentHistory: [] as PersistentHistoryEntry[],
    snapshots: [] as Snapshot[],
    saveSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    previewSnapshot,
    exitPreview,
    isPreviewMode: !!viewingSnapshotId,
  };
}
