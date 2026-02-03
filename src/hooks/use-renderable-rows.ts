import { useMemo } from 'react';
import { startOfDay } from 'date-fns';
import type { ProjectState, Task, RenderableRow } from '@/lib/types';
import { getRawTaskPropertyValue, getTaskPropertyValue } from '@/lib/task-utils';

export function useRenderableRows(projectState: ProjectState) {
    const { tasks, resources, assignments, columns, grouping, groupingState, filters, sortColumn, sortDirection } = projectState;
    const resourceMap = useMemo(() => new Map(resources.map(r => [r.id, r.name])), [resources]);

    const renderableRows: RenderableRow[] = useMemo(() => {
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const checkCondition = (rawValue: any, operator: string, filterValue: any, columnType?: 'text' | 'number' | 'selection' | 'date'): boolean => {
            if (operator === 'is_empty') {
                return rawValue === null || rawValue === undefined || rawValue === '';
            }
            if (operator === 'is_not_empty') {
                return rawValue !== null && rawValue !== undefined && rawValue !== '';
            }
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                return false;
            }

            switch (columnType) {
                case 'number': {
                    const numValue = parseFloat(rawValue);
                    const numFilterValue = parseFloat(filterValue);
                    if (isNaN(numValue) || isNaN(numFilterValue)) return false;
                    switch (operator) {
                        case 'equals': return numValue === numFilterValue;
                        case 'not_equals': return numValue !== numFilterValue;
                        case 'gt': return numValue > numFilterValue;
                        case 'lt': return numValue < numFilterValue;
                        case 'gte': return numValue >= numFilterValue;
                        case 'lte': return numValue <= numFilterValue;
                        default: return false;
                    }
                }
                case 'date': {
                    const dateValue = startOfDay(new Date(rawValue)).getTime();
                    const dateFilterValue = startOfDay(new Date(filterValue)).getTime();
                    if (isNaN(dateValue) || isNaN(dateFilterValue)) return false;
                     switch (operator) {
                        case 'equals': return dateValue === dateFilterValue;
                        case 'not_equals': return dateValue !== dateFilterValue;
                        case 'gt': return dateValue > dateFilterValue;
                        case 'lt': return dateValue < dateFilterValue;
                        case 'gte': return dateValue >= dateFilterValue;
                        case 'lte': return dateValue <= dateFilterValue;
                        default: return false;
                    }
                }
                case 'selection': {
                     switch (operator) {
                        case 'equals': return rawValue === filterValue;
                        case 'not_equals': return rawValue !== filterValue;
                        default: return false;
                     }
                }
                case 'text':
                default: {
                    const textValue = String(rawValue).toLowerCase();
                    const textFilterValue = String(filterValue).toLowerCase();
                     switch (operator) {
                        case 'contains': return textValue.includes(textFilterValue);
                        case 'not_contains': return !textValue.includes(textFilterValue);
                        case 'equals': return textValue === textFilterValue;
                        case 'not_equals': return textValue !== textFilterValue;
                        default: return false;
                     }
                }
            }
        }

        let filteredTaskIds = new Set(tasks.map(t => t.id));

        if (filters && filters.length > 0) {
            const matchingTaskIds = new Set<string>();

            tasks.forEach(task => {
                if (task.isSummary) return;

                const isMatch = filters.every(filter => {
                    if (filter.operator === 'contains') {
                         const formattedValue = getTaskPropertyValue(task, filter.columnId, columns, assignments, resourceMap);
                         return formattedValue.toLowerCase().includes(String(filter.value).toLowerCase());
                    }

                    const rawValue = getRawTaskPropertyValue(task, filter.columnId, columns, assignments, resourceMap);
                    const column = columns.find(c => c.id === filter.columnId);

                    let type = column?.type;
                    if (['start', 'finish', 'constraintDate'].includes(filter.columnId)) {
                        type = 'date';
                    }

                    return checkCondition(rawValue, filter.operator, filter.value, type);
                });

                if (isMatch) {
                    matchingTaskIds.add(task.id);
                }
            });

            filteredTaskIds = new Set();
            matchingTaskIds.forEach(id => {
                let current = taskMap.get(id);
                while(current) {
                    filteredTaskIds.add(current.id);
                    current = current.parentId ? taskMap.get(current.parentId) : undefined;
                }
            });
        }

        const finalTasks = tasks.filter(t => filteredTaskIds.has(t.id));

        const compareTasks = (a: Task, b: Task): number => {
            if (!sortColumn || !sortDirection) return 0;
            const valA = getRawTaskPropertyValue(a, sortColumn, columns, assignments, resourceMap);
            const valB = getRawTaskPropertyValue(b, sortColumn, columns, assignments, resourceMap);

            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        };

        const getVisibleHierarchicalTasks = (): Task[] => {
            const tasksByParent = new Map<string, Task[]>();
            finalTasks.forEach(t => {
                const pId = t.parentId || 'root';
                if (!tasksByParent.has(pId)) tasksByParent.set(pId, []);
                tasksByParent.get(pId)!.push(t);
            });

            tasksByParent.forEach(siblings => {
                siblings.sort(compareTasks);
            });

            const flattened: Task[] = [];
            const traverse = (parentId: string) => {
                const children = tasksByParent.get(parentId) || [];
                for (const child of children) {
                    flattened.push(child);
                    traverse(child.id);
                }
            };
            traverse('root');

            return flattened.filter(task => {
                if (!task.parentId) return true;
                let parent = taskMap.get(task.parentId);
                while(parent) {
                    if (parent.isCollapsed && filteredTaskIds.has(parent.id)) return false;
                    parent = taskMap.get(parent.parentId || '');
                }
                return true;
            });
        };

        if (grouping.length > 0) {
            const finalRows: RenderableRow[] = [];
            const groupRecursively = (tasksToGroup: Task[], groupLevel: number) => {
                if (groupLevel >= grouping.length) {
                    tasksToGroup.sort(compareTasks).forEach(task => {
                        finalRows.push({ itemType: 'task', data: task, displayLevel: groupLevel });
                    });
                    return;
                }

                const groupField = grouping[groupLevel];
                const grouped = new Map<string, Task[]>();

                for (const task of tasksToGroup) {
                    const groupValue = getTaskPropertyValue(task, groupField, columns, assignments, resourceMap);
                    if (!grouped.has(groupValue)) {
                        grouped.set(groupValue, []);
                    }
                    grouped.get(groupValue)!.push(task);
                }

                const sortedGroupKeys = Array.from(grouped.keys()).sort();

                for (const key of sortedGroupKeys) {
                    const groupTasks = grouped.get(key)!;
                    const groupColumn = columns.find(c => c.id === groupField);
                    const groupId = `group-${groupLevel}-${key}`;

                    const { mode, overrides } = groupingState;
                    const isCollapsed = mode === 'expanded'
                        ? overrides.includes(groupId)
                        : !overrides.includes(groupId);

                    finalRows.push({
                        itemType: 'group',
                        name: `${groupColumn?.name}: ${key}`,
                        level: groupLevel,
                        id: groupId,
                        childCount: groupTasks.length,
                        isCollapsed: isCollapsed,
                    });

                    if (!isCollapsed) {
                        groupRecursively(groupTasks, groupLevel + 1);
                    }
                }
            }
            groupRecursively(finalTasks, 0);
            return finalRows;
        } else {
             return getVisibleHierarchicalTasks().map(task => ({ itemType: 'task', data: task, displayLevel: task.level || 0 }));
        }
    }, [tasks, filters, grouping, groupingState, columns, assignments, resourceMap, sortColumn, sortDirection]);

    return { renderableRows };
}
