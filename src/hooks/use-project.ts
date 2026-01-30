'use client';

import { useReducer, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { ProjectState, Task, Link, ColumnSpec, UiDensity, LinkType, Resource, Assignment, Calendar, Exception, View, Note, Filter, GanttSettings, HistoryEntry, Representation, Project, ProjectMember, StylePreset, Baseline } from '@/lib/types';
import { calculateSchedule } from '@/lib/scheduler';
import { calendarService } from '@/lib/calendar';
import { format } from 'date-fns';
import { parseDuration, formatDuration } from '@/lib/duration';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, query, orderBy, setDoc, onSnapshot } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { User } from 'firebase/auth';
import { useToast } from "@/hooks/use-toast";
import { ALL_COLUMNS, initialColumns, initialVisibleColumns } from '@/lib/columns';
import { THEME_PRESETS } from '@/lib/theme-config';


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
  summaryDurationUnit: 'day',
  theme: 'dark',
  customStyles: {},
  comparisonBaselineId: null,
};

const defaultStylePresets: StylePreset[] = THEME_PRESETS;

const defaultAppSettings = {
    id: 'app_settings',
    columns: initialColumns,
    visibleColumns: initialVisibleColumns,
    grouping: [],
    filters: [],
    stylePresets: defaultStylePresets,
};

const defaultUserPreferences = {
    uiDensity: 'compact' as UiDensity,
    currentViewId: 'default',
    ganttSettings: initialGanttSettings,
    activeStylePresetId: 'default-dark',
};


const initialState: ProjectState = {
  tasks: [],
  links: [],
  resources: [],
  assignments: [],
  zones: [],
  calendars: [],
  defaultCalendarId: null,
  baselines: [],
  
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
  | { type: 'SET_PROJECT_DATA', payload: { tasks: Task[], links: Link[], resources: Resource[], assignments: Assignment[], calendars: Calendar[], baselines: Baseline[] } }
  | { type: 'SET_PERSISTED_STATE', payload: { views: View[], sharedSettings: typeof defaultAppSettings | null, userPreferences: typeof defaultUserPreferences | null, member: ProjectMember | null } }
  | { type: 'SCHEDULE_PROJECT' }
  | { type: 'UPDATE_TASK'; payload: Partial<Task> & { id: string } }
  | { type: 'UPDATE_LINK'; payload: Partial<Link> & { id: string } }
  | { type: 'SET_ROW_SELECTION', payload: { taskId: string, shiftKey?: boolean, ctrlKey?: boolean } }
  | { type: 'SET_CELL_SELECTION', payload: { taskId: string, columnId: string, shiftKey?: boolean } }
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
  | { type: 'TOGGLE_MULTI_SELECT_MODE' }
  | { type: 'ADD_NOTE_TO_TASK'; payload: { taskId: string; content: string } }
  | { type: 'ADD_TASKS_FROM_PASTE', payload: { data: string, activeCell: { taskId: string, columnId: string } | null } }
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
  | { type: 'SORT_TASKS', payload: { columnId: string } };

/**
 * Creates a "clean" task object suitable for Firestore,
 * removing calculated fields and converting `undefined` to `null`.
 */
const toFirestoreTask = (task: Task) => {
  const { isCritical, totalFloat, lateStart, lateFinish, projectId, criticalFor, ...rest } = task;

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

function useSubprojectData(subprojectIds: string[] | undefined, firestore: any) {
    const [data, setData] = useState<{ tasks: Task[], links: Link[] }>({ tasks: [], links: [] });

    useEffect(() => {
        if (!subprojectIds || subprojectIds.length === 0 || !firestore) {
            setData({ tasks: [], links: [] });
            return;
        }

        const unsubscribes: (() => void)[] = [];
        const localCache: Record<string, { tasks: Task[], links: Link[] }> = {};

        // Initialize cache
        subprojectIds.forEach(id => localCache[id] = { tasks: [], links: [] });

        const updateData = () => {
            const allTasks = Object.values(localCache).flatMap(c => c.tasks);
            const allLinks = Object.values(localCache).flatMap(c => c.links);
            setData({ tasks: allTasks, links: allLinks });
        };

        subprojectIds.forEach(pId => {
            // Tasks
            const tasksUnsub = onSnapshot(query(collection(firestore, 'projects', pId, 'tasks'), orderBy('order')), (snap) => {
                const tasks = snap.docs.map(d => {
                     const data = d.data();
                     // Helper to handle Firestore timestamps
                     const safeToDate = (value: any): Date | null => {
                        if (!value) return null;
                        if (typeof value === 'object' && value !== null && typeof value.toDate === 'function') {
                            return value.toDate();
                        }
                        const d = new Date(value);
                        return !isNaN(d.getTime()) ? d : null;
                    }

                     return {
                         ...data,
                         id: d.id,
                         projectId: pId,
                         start: safeToDate(data.start)!,
                         finish: safeToDate(data.finish)!,
                         constraintDate: safeToDate(data.constraintDate),
                         deadline: safeToDate(data.deadline),
                     } as Task;
                });
                localCache[pId].tasks = tasks;
                updateData();
            });
            unsubscribes.push(tasksUnsub);

            // Links
            const linksUnsub = onSnapshot(collection(firestore, 'projects', pId, 'links'), (snap) => {
                localCache[pId].links = snap.docs.map(d => ({ ...d.data(), id: d.id, sourceProjectId: pId } as Link));
                updateData();
            });
            unsubscribes.push(linksUnsub);
        });

        return () => unsubscribes.forEach(u => u());
    }, [JSON.stringify(subprojectIds), firestore]);

    return data;
}

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

function getTaskIdsInSelection(state: ProjectState): Set<string> {
    if (state.selectionMode === 'row') {
        return new Set(state.selectedTaskIds);
    }
    if (state.selectionMode === 'cell' && state.anchorCell && state.focusCell) {
        const visibleTasks = getVisibleTasks(state.tasks);
        const taskIds = new Set<string>();
        
        const r1 = visibleTasks.findIndex(t => t.id === state.anchorCell!.taskId);
        const r2 = visibleTasks.findIndex(t => t.id === state.focusCell!.taskId);

        if (r1 === -1 || r2 === -1) return taskIds;

        const rowStart = Math.min(r1, r2);
        const rowEnd = Math.max(r1, r2);
        
        for (let i = rowStart; i <= rowEnd; i++) {
            taskIds.add(visibleTasks[i].id);
        }
        return taskIds;
    }
    return new Set();
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
      const { tasks, links, resources, assignments, calendars, baselines } = action.payload;
      const defaultCalendarId = state.defaultCalendarId || calendars.find(c => c.name === "Standard")?.id || calendars[0]?.id || null;
      const scheduledTasks = runScheduler(tasks, links, state.columns, calendars, defaultCalendarId);
      return {
        ...state,
        tasks: scheduledTasks,
        links,
        resources,
        assignments,
        calendars,
        baselines: baselines || [],
        defaultCalendarId,
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

        let finalVisibleColumns = currentView.visibleColumns || initialVisibleColumns;

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
            grouping: currentView.grouping || [],
            visibleColumns: finalVisibleColumns,
            filters: currentView.filters || [],
        };
        
        return {
            ...state,
            views: newViews,
            columns: newSharedSettings.columns || initialColumns,
            uiDensity: finalUiDensity,
            ganttSettings: finalGanttSettings,
            stylePresets: loadedStylePresets,
            activeStylePresetId: finalActiveStylePresetId,
            currentViewId: currentView.id,
            grouping: currentView.grouping || [],
            visibleColumns: finalVisibleColumns,
            filters: currentView.filters || [],
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
        const { id, name, initials } = action.payload || {};
        const maxOrder = state.resources.length > 0 ? Math.max(...state.resources.map(r => r.order ?? 0)) : -1;
        const newResource: Resource = {
            id: id || `res-${Date.now()}`,
            name: name || 'New Resource',
            initials: initials,
            type: 'Work',
            availability: 1,
            costPerHour: 0,
            order: maxOrder + 1,
        };
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
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
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
        const reScheduledTasks = runScheduler(state.tasks, state.links, state.columns, newCalendars, state.defaultCalendarId);
        return { ...state, calendars: newCalendars, tasks: reScheduledTasks, isDirty: checkDirty({ ...state, calendars: newCalendars }) };
    }
     case 'REMOVE_CALENDAR': {
        const { calendarId } = action.payload;
        if (state.calendars.length <= 1) return state;
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
        };
    }
    case 'SET_CELL_SELECTION': {
        const { taskId, columnId, shiftKey } = action.payload;
        const newFocusCell = { taskId, columnId };
        
        // If not shift-clicking or if we were in row mode, the anchor becomes the new focus.
        const newAnchorCell = (!shiftKey || state.selectionMode !== 'cell')
            ? newFocusCell
            : state.anchorCell || state.focusCell || newFocusCell;

        return {
            ...state,
            selectionMode: 'cell',
            focusCell: newFocusCell,
            anchorCell: newAnchorCell,
            selectedTaskIds: [],
            selectionAnchor: null,
        };
    }
    case 'TOGGLE_TASK_COLLAPSE': {
      const newTasks = state.tasks.map(task => 
        task.id === action.payload.taskId ? { ...task, isCollapsed: !task.isCollapsed } : task
      );
      return { ...state, tasks: newTasks };
    }
    case 'COLLAPSE_ALL': {
        const taskIdsInSelection = getTaskIdsInSelection(state);
        const shouldCollapseSelected = taskIdsInSelection.size > 0;

        const newTasks = state.tasks.map(task => {
            if (task.isSummary) {
                if (shouldCollapseSelected) {
                    if (taskIdsInSelection.has(task.id)) {
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
        const taskIdsInSelection = getTaskIdsInSelection(state);
        const shouldExpandSelected = taskIdsInSelection.size > 0;

        const newTasks = state.tasks.map(task => {
            if (task.isSummary) {
                if (shouldExpandSelected) {
                    if (taskIdsInSelection.has(task.id)) {
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
                const pastedLinks: Link[] = parsedData.links || [];
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
                
                const newLinksFromPaste: Link[] = pastedLinks.map(link => ({
                    ...link,
                    id: `link-${Date.now()}-${Math.random()}`.replace('.', ''),
                    source: idMap.get(link.source)!,
                    target: idMap.get(link.target)!,
                }));
                
                const allTasks = [...state.tasks];
                allTasks.splice(targetIndex, 0, ...newTasks);
                
                const allLinks = [...state.links, ...newLinksFromPaste];
                
                const scheduledTasks = runScheduler(allTasks, allLinks, state.columns, state.calendars, state.defaultCalendarId);
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
        const ganttSettings = { ...initialState.ganttSettings, ...(loaded.ganttSettings || {}) };
        const stylePresets = loaded.stylePresets?.length ? loaded.stylePresets : defaultStylePresets;
        
        const loadedState = { 
            ...initialState, 
            ...loaded,
            ganttSettings: ganttSettings,
            stylePresets: stylePresets,
        };
        const scheduledTasks = runScheduler(loadedState.tasks, loadedState.links, loadedState.columns, loadedState.calendars, loadedState.defaultCalendarId);
        return {
            ...loadedState,
            tasks: scheduledTasks,
            isDirty: false
        };
    }
    case 'ADD_TASK': {
        const newId = `task-${Date.now()}`;
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
        };
        
        let newTasks = [...state.tasks];
        if (lastSelectedId) {
            const selectedIndex = newTasks.findIndex(t => t.id === lastSelectedId);
            newTasks.splice(selectedIndex + 1, 0, ...[newTask]);
        } else {
            newTasks.push(newTask);
        }
        
        const scheduledTasks = runScheduler(newTasks, state.links, state.columns, state.calendars, state.defaultCalendarId);
        return { 
            ...state, 
            tasks: scheduledTasks, 
            selectionMode: 'cell',
            focusCell: { taskId: newTask.id, columnId: 'name' },
            anchorCell: { taskId: newTask.id, columnId: 'name' },
            selectedTaskIds: [],
            selectionAnchor: null,
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
        
        const scheduledTasks = runScheduler(newTasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        return { 
            ...state, 
            tasks: scheduledTasks, 
            links: newLinks, 
            selectedTaskIds: [],
            selectionAnchor: null,
            focusCell: null,
            anchorCell: null,
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
        const scheduledTasks = runScheduler(updatedTasks, newLinks, state.columns, state.calendars, state.defaultCalendarId);
        
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
        
        const nonHistoricActions: Action['type'][] = [
            'SET_PROJECT_DATA', 
            'SET_PERSISTED_STATE',
            'SET_ROW_SELECTION',
            'SET_CELL_SELECTION',
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
  const historyStateRef = useRef(historyState);

  useEffect(() => {
      historyStateRef.current = historyState;
  }, [historyState]);


  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  // Effect to get admin status
  useEffect(() => {
    if (user) {
      setIsCheckingAdmin(true);
      user.getIdTokenResult(true).then((idTokenResult) => {
        setIsAdmin(!!idTokenResult.claims.admin);
        setIsCheckingAdmin(false);
      });
    } else {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
    }
  }, [user, projectId]);

  const { data: member, isLoading: isMemberLoading } = useDoc<ProjectMember>(
      useMemoFirebase(() => (projectId && user) ? doc(firestore, 'projects', projectId, 'members', user.uid) : null, [firestore, projectId, user])
  );
  
  const projectDocRef = useMemoFirebase(() => projectId ? doc(firestore, 'projects', projectId) : null, [firestore, projectId]);
  const { data: projectData } = useDoc<Project>(projectDocRef);

  const subprojectsData = useSubprojectData(projectData?.subprojectIds, firestore);
  
  // Effect to migrate legacy projects by creating member documents if they don't exist
  useEffect(() => {
    const performMigration = async () => {
      if (firestore && user && projectData && !isMemberLoading && !member) {
        if (projectData.memberIds && projectData.memberIds.includes(user.uid)) {
          console.log(`Migrating user ${user.uid} to members subcollection for project ${projectData.id}`);
          const memberDocRef = doc(firestore, 'projects', projectData.id, 'members', user.uid);
          
          const role = projectData.ownerId === user.uid ? 'owner' : 'viewer';

          const newMemberData: Omit<ProjectMember, 'permissions'> = {
              userId: user.uid,
              role: role,
              displayName: user.displayName || user.email || '',
              photoURL: user.photoURL || '',
          };

          try {
            // Use a blocking setDoc here to ensure the document exists on the backend
            // before other data-fetching hooks that depend on it are triggered.
            await setDoc(memberDocRef, newMemberData, { merge: false });
          } catch (e) {
             console.error("Failed to migrate user to members subcollection:", e);
             // We can optionally toast an error here if migration is critical for app function
          }
        }
      }
    }
    
    performMigration();
  }, [firestore, user, projectData, isMemberLoading, member]);

  const isEditorOrOwner = useMemo(() => {
    if (isMemberLoading || isCheckingAdmin) {
      return false; // Default to non-editor while loading to be safe
    }
    return isAdmin || member?.role === 'editor' || member?.role === 'owner';
  }, [isMemberLoading, isCheckingAdmin, member, isAdmin]);
  
  const dispatch = useCallback((action: Action) => {
    // These actions should bypass the batching logic and directly manipulate the history state.
    if (action.type === 'UNDO' || action.type === 'REDO' || action.type === 'JUMP_TO_HISTORY') {
        internalDispatch(action);
        return;
    }

    if (!user || !projectId) {
        internalDispatch(action);
        return;
    }
    
    // This is the new centralized permission guard.
    const isEditAction = (act: Action): boolean => {
        const dataWriteActions: Action['type'][] = [
            'UPDATE_TASK', 'ADD_NOTE_TO_TASK', 'UPDATE_RESOURCE', 'UPDATE_CALENDAR',
            'UPDATE_LINK', 'ADD_TASK', 'REMOVE_TASK', 'LINK_TASKS', 'ADD_LINK', 'REMOVE_LINK',
            'UPDATE_RELATIONSHIPS', 'INDENT_TASK', 'OUTDENT_TASK', 'REORDER_TASKS', 'NEST_TASKS',
            'ADD_RESOURCE', 'REMOVE_RESOURCE', 'REORDER_RESOURCE', 'ADD_CALENDAR', 'REMOVE_CALENDAR',
            'ADD_TASKS_FROM_PASTE', 'FIND_AND_REPLACE', 'ADD_BASELINE', 'DELETE_BASELINE',
            'ADD_ASSIGNMENT', 'UPDATE_ASSIGNMENT', 'REMOVE_ASSIGNMENT',
          ];
    
          const sharedSettingsActions: Action['type'][] = [
            'SAVE_VIEW_AS', 'UPDATE_CURRENT_VIEW', 'SET_GROUPING', 'SET_FILTERS',
            'SET_COLUMNS', 'ADD_COLUMN', 'UPDATE_COLUMN', 'REMOVE_COLUMN',
            'RESIZE_COLUMN', 'REORDER_COLUMNS', 'DELETE_VIEW',
            'SET_STYLE_PRESETS',
          ];
          return dataWriteActions.includes(act.type) || sharedSettingsActions.includes(act.type);
    }


    if (isEditAction(action)) {
        if (!isEditorOrOwner) {
             toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'You do not have permission to perform this action.',
            });
            return;
        }
    }

    const optimisticActions: Action['type'][] = [
      'ADD_NOTE_TO_TASK', 'UPDATE_TASK', 'UPDATE_RESOURCE', 'UPDATE_CALENDAR',
    ];
    
    const userSettingsActions: Action['type'][] = [
        'UPDATE_GANTT_SETTINGS', 'SET_UI_DENSITY', 'SET_VIEW',
        'SET_ACTIVE_STYLE_PRESET'
    ];

    if (userSettingsActions.includes(action.type)) {
        internalDispatch(action);
        const newState = projectReducer(historyStateRef.current.present, action);
        const userPrefsDocRef = doc(firestore, 'user_preferences', `${user.uid}_${projectId}`);

        const prefsToUpdate: Partial<typeof defaultUserPreferences> = {};
        if (action.type === 'UPDATE_GANTT_SETTINGS') {
             prefsToUpdate.ganttSettings = newState.ganttSettings;
             prefsToUpdate.activeStylePresetId = newState.activeStylePresetId;
        }
        if (action.type === 'SET_UI_DENSITY') {
            prefsToUpdate.uiDensity = newState.uiDensity;
        }
         if (action.type === 'SET_VIEW') {
            prefsToUpdate.currentViewId = newState.currentViewId;
        }
        if (action.type === 'SET_ACTIVE_STYLE_PRESET') {
            prefsToUpdate.activeStylePresetId = newState.activeStylePresetId;
            prefsToUpdate.ganttSettings = newState.ganttSettings;
        }

        setDocumentNonBlocking(userPrefsDocRef, prefsToUpdate, { merge: true });

    } else if (optimisticActions.includes(action.type)) {
        internalDispatch(action); 
        
        const newState = projectReducer(historyStateRef.current.present, action);
        const batch = writeBatch(firestore);

        if (action.type === 'UPDATE_TASK' || action.type === 'ADD_NOTE_TO_TASK') {
            const taskId = (action.payload as { id: string }).id;
            const updatedTask = newState.tasks.find(t => t.id === taskId);
            const targetProjectId = updatedTask?.projectId || projectId;

            if (updatedTask) {
                const { ...updateData } = toFirestoreTask(updatedTask);
                batch.update(doc(firestore, 'projects', targetProjectId, 'tasks', taskId), updateData);
            }
        }
        
        if (action.type === 'UPDATE_RESOURCE') {
            const { id, ...updateData } = action.payload as { id: string };
            batch.update(doc(firestore, 'projects', projectId, 'resources', id), updateData);
        }
        if (action.type === 'UPDATE_CALENDAR') {
            const { id, ...updateData } = action.payload as { id: string };
            batch.update(doc(firestore, 'projects', projectId, 'calendars', id), updateData);
        }

        batch.commit().catch(e => {
            console.error(`Optimistic action ${action.type} failed to commit.`, e);
            toast({
              variant: 'destructive',
              title: 'Error Saving Changes',
              description: `Your action (${action.type}) could not be saved. The UI will revert.`,
            });
            // Revert state if commit fails - may need more robust history implementation
            internalDispatch({ type: 'UNDO' });
        });

    } else { 
        const currentState = historyStateRef.current.present;
        const newState = projectReducer(currentState, action);
        const batch = writeBatch(firestore);

        // ... existing batch logic for tasks, links ...
        newState.links.forEach(newLink => {
            const oldLink = currentState.links.find(l => l.id === newLink.id);
            const { isDriving, ...linkData } = newLink;
            if (!oldLink) {
                batch.set(doc(firestore, 'projects', projectId, 'links', newLink.id), linkData);
            } else {
                const { isDriving: oldIsDriving, ...oldLinkData } = oldLink;
                if (JSON.stringify(oldLinkData) !== JSON.stringify(linkData)) {
                        batch.update(doc(firestore, 'projects', projectId, 'links', newLink.id), linkData);
                }
            }
        });
        currentState.links.forEach(oldLink => {
            if (!newState.links.some(l => l.id === oldLink.id)) {
                batch.delete(doc(firestore, 'projects', projectId, 'links', oldLink.id));
            }
        });

        newState.resources.forEach(newResource => {
            const oldResource = currentState.resources.find(r => r.id === newResource.id);
            if (!oldResource) {
                batch.set(doc(firestore, 'projects', projectId, 'resources', newResource.id), newResource);
            } else {
                if (JSON.stringify(oldResource) !== JSON.stringify(newResource)) {
                    batch.update(doc(firestore, 'projects', projectId, 'resources', newResource.id), newResource as any);
                }
            }
        });
        currentState.resources.forEach(oldResource => {
            if (!newState.resources.some(r => r.id === oldResource.id)) {
                batch.delete(doc(firestore, 'projects', projectId, 'resources', oldResource.id));
            }
        });

        newState.assignments.forEach(newAssignment => {
            const oldAssignment = currentState.assignments.find(a => a.id === newAssignment.id);
            const { resource, ...assignmentData } = newAssignment as any;
            if (!oldAssignment) {
                batch.set(doc(firestore, 'projects', projectId, 'assignments', newAssignment.id), assignmentData);
            } else {
                const { resource: oldResource, ...oldAssignmentData } = oldAssignment as any;
                if (JSON.stringify(oldAssignmentData) !== JSON.stringify(assignmentData)) {
                    batch.update(doc(firestore, 'projects', projectId, 'assignments', newAssignment.id), assignmentData as any);
                }
            }
        });
        currentState.assignments.forEach(oldAssignment => {
            if (!newState.assignments.some(a => a.id === oldAssignment.id)) {
                batch.delete(doc(firestore, 'projects', projectId, 'assignments', oldAssignment.id));
            }
        });

        if (action.type === 'ADD_BASELINE') {
            const newBaseline = newState.baselines.find(b => !currentState.baselines.some(cb => cb.id === b.id));
            if (newBaseline) {
                batch.set(doc(firestore, 'projects', projectId, 'baselines', newBaseline.id), {
                    ...newBaseline,
                    createdAt: newBaseline.createdAt,
                    tasks: newBaseline.tasks.map(t => toFirestoreTask(t))
                });
            }
        }

        if (action.type === 'DELETE_BASELINE') {
            const deletedBaseline = currentState.baselines.find(b => !newState.baselines.some(nb => nb.id === b.id));
            if (deletedBaseline) {
                batch.delete(doc(firestore, 'projects', projectId, 'baselines', deletedBaseline.id));
            }
        }

        newState.tasks.forEach(newTask => {
            const oldTask = currentState.tasks.find(t => t.id === newTask.id);
            const targetProjectId = newTask.projectId || projectId;

            if (!oldTask) {
                batch.set(doc(firestore, 'projects', targetProjectId, 'tasks', newTask.id), toFirestoreTask(newTask));
            } else {
                 if (JSON.stringify(toFirestoreTask(oldTask)) !== JSON.stringify(toFirestoreTask(newTask))) {
                     const { id, ...updateData } = toFirestoreTask(newTask);
                     batch.update(doc(firestore, 'projects', targetProjectId, 'tasks', newTask.id), updateData);
                 }
            }
        });
        currentState.tasks.forEach(oldTask => {
            if (!newState.tasks.some(t => t.id === oldTask.id)) {
                const targetProjectId = oldTask.projectId || projectId;
                batch.delete(doc(firestore, 'projects', targetProjectId, 'tasks', oldTask.id));
            }
        });
        
        if (isEditAction(action)) {
            const sharedSettingsDocRef = doc(firestore, 'projects', projectId, 'settings', 'app_settings');
             const settingsToUpdate: Partial<typeof defaultAppSettings> = {
                columns: newState.columns,
                visibleColumns: newState.visibleColumns,
                grouping: newState.grouping,
                filters: newState.filters,
                stylePresets: newState.stylePresets,
            };
            batch.set(sharedSettingsDocRef, settingsToUpdate, { merge: true });
            
            if (action.type === 'SAVE_VIEW_AS') {
                 const newView = newState.views.find(v => v.id === newState.currentViewId);
                 if (newView) batch.set(doc(firestore, 'projects', projectId, 'views', newView.id), newView);
            } else if (action.type === 'UPDATE_CURRENT_VIEW' && newState.currentViewId) {
                const updatedView = newState.views.find(v => v.id === newState.currentViewId);
                if (updatedView) {
                    const { id, ...viewData } = updatedView;
                    batch.update(doc(firestore, 'projects', projectId, 'views', id), viewData);
                }
            } else if (action.type === 'DELETE_VIEW') {
                 batch.delete(doc(firestore, 'projects', projectId, 'views', (action.payload as any).viewId));
            }
        }

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
    }
  }, [user, projectId, firestore, toast, isEditorOrOwner]);
  
  const collections = {
    tasks: useCollection<Task>(useMemoFirebase(() => (projectId && member) ? query(collection(firestore, 'projects', projectId, 'tasks'), orderBy('order')) : null, [firestore, projectId, member])),
    links: useCollection<Link>(useMemoFirebase(() => (projectId && member) ? collection(firestore, 'projects', projectId, 'links') : null, [firestore, projectId, member])),
    resources: useCollection<Resource>(useMemoFirebase(() => (projectId && member) ? collection(firestore, 'projects', projectId, 'resources') : null, [firestore, projectId, member])),
    assignments: useCollection<Assignment>(useMemoFirebase(() => (projectId && member) ? collection(firestore, 'projects', projectId, 'assignments') : null, [firestore, projectId, member])),
    calendars: useCollection<Calendar>(useMemoFirebase(() => (projectId && member) ? collection(firestore, 'projects', projectId, 'calendars') : null, [firestore, projectId, member])),
    views: useCollection<View>(useMemoFirebase(() => (projectId && member) ? collection(firestore, 'projects', projectId, 'views') : null, [firestore, projectId, member])),
    sharedSettings: useDoc<typeof defaultAppSettings>(useMemoFirebase(() => (projectId && member) ? doc(firestore, 'projects', projectId, 'settings', 'app_settings') : null, [firestore, projectId, member])),
    userPreferences: useDoc<typeof defaultUserPreferences>(useMemoFirebase(() => (projectId && user) ? doc(firestore, 'user_preferences', `${user.uid}_${projectId}`) : null, [firestore, user, projectId])),
    baselines: useCollection<Baseline>(useMemoFirebase(() => (projectId && member) ? collection(firestore, 'projects', projectId, 'baselines') : null, [firestore, projectId, member])),
  };
  
  // Effect 1: Data Synchronization from Firestore
  useEffect(() => {
    // On project change, reset loaded state until all collections are confirmed loaded
    setIsLoaded(false);
  }, [projectId]);

  useEffect(() => {
    const allCollectionsLoading = collections.tasks.isLoading || collections.links.isLoading || collections.resources.isLoading || collections.assignments.isLoading || collections.calendars.isLoading || collections.baselines.isLoading;
    const allLoading = allCollectionsLoading || isMemberLoading || isCheckingAdmin;

    if (!projectId || allLoading || !member) {
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

    const mainTasks = (collections.tasks.data || []).map(t => ({
        ...t,
        projectId: projectId,
        start: safeToDate(t.start)!,
        finish: safeToDate(t.finish)!,
        constraintDate: safeToDate(t.constraintDate),
        deadline: safeToDate(t.deadline)
    }));

    const allTasks = [...mainTasks, ...subprojectsData.tasks];
    const allLinks = [...(collections.links.data || []), ...subprojectsData.links];

    internalDispatch({
        type: 'SET_PROJECT_DATA',
        payload: {
            tasks: allTasks,
            links: allLinks,
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
            baselines: (collections.baselines.data || []).map(b => ({
                ...b,
                createdAt: safeToDate(b.createdAt)!,
                tasks: (b.tasks || []).map(t => ({
                    ...t,
                    start: safeToDate(t.start)!,
                    finish: safeToDate(t.finish)!,
                    constraintDate: safeToDate(t.constraintDate),
                    deadline: safeToDate(t.deadline),
                }))
            }))
        }
    });

    if (!isLoaded) {
        setIsLoaded(true);
    }
  }, [
    projectId, isMemberLoading, isCheckingAdmin, member,
    collections.tasks.data, collections.tasks.isLoading,
    subprojectsData.tasks, subprojectsData.links,
    collections.links.data, collections.links.isLoading,
    collections.resources.data, collections.resources.isLoading,
    collections.assignments.data, collections.assignments.isLoading,
    collections.calendars.data, collections.calendars.isLoading,
    collections.baselines.data, collections.baselines.isLoading,
  ]);

  // Effect 2: Sync Settings Data
  useEffect(() => {
    if (!isLoaded || collections.views.isLoading || collections.sharedSettings.isLoading || collections.userPreferences.isLoading) return;
    
    const sharedSettings = collections.sharedSettings.data ? { ...defaultAppSettings, ...collections.sharedSettings.data } : defaultAppSettings;
    let userPreferences = collections.userPreferences.data ? { ...defaultUserPreferences, ...collections.userPreferences.data } : null;

    if (userPreferences?.ganttSettings?.dateFormat) {
        try {
            format(new Date(), userPreferences.ganttSettings.dateFormat);
        } catch (e) {
            console.warn(`Invalid date format string "${userPreferences.ganttSettings.dateFormat}" found in user preferences. Resetting to default.`);
            userPreferences.ganttSettings.dateFormat = defaultUserPreferences.ganttSettings.dateFormat;
        }
    }
    
    internalDispatch({
      type: 'SET_PERSISTED_STATE',
      payload: {
        views: collections.views.data || [],
        sharedSettings: sharedSettings,
        userPreferences: userPreferences,
        member: member,
      }
    });
  }, [
    isLoaded,
    collections.views.isLoading, collections.sharedSettings.isLoading, collections.userPreferences.isLoading, 
    member, 
    collections.views.data, collections.sharedSettings.data, collections.userPreferences.data
  ]);


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
    dispatch,
    isLoaded: isLoaded && projectId && !isCheckingAdmin && !isMemberLoading,
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
