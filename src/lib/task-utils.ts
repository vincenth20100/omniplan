import { Task, ColumnSpec, Assignment } from './types';
import { format } from 'date-fns';

export function getRawTaskPropertyValue(
    task: Task,
    columnId: string,
    columns: ColumnSpec[],
    assignments: Assignment[],
    resourceMap: Map<string, string>
): any {
    const column = columns.find(c => c.id === columnId);
    if (!column) return null;

    switch (column.id) {
        case 'resourceNames': {
            const taskAssignments = assignments.filter(a => a.taskId === task.id);
            const resourceNames = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
            return resourceNames || null;
        }
        case 'constraintType':
            return task.constraintType || null;
        case 'cost':
            return task.cost || 0;
        case 'duration':
            return task.duration;
        case 'start':
            return task.start;
        case 'finish':
            return task.finish;
        case 'percentComplete':
            return task.percentComplete;
        case 'constraintDate':
            return task.constraintDate || null;
        case 'name':
            return task.name;
        case 'projectSource':
            return task.projectName || null;
        case 'isCritical':
            return task.isCritical ? '*' : '';
        case 'totalFloat':
        case 'slack':
            return task.totalFloat ?? null;
        case 'freeFloat':
            return task.freeFloat ?? null;
        default:
            if (column.id.startsWith('custom-')) {
                return task.customAttributes?.[column.id] || null;
            }
            return null;
    }
}

export function getTaskPropertyValue(
    task: Task,
    columnId: string,
    columns: ColumnSpec[],
    assignments: Assignment[],
    resourceMap: Map<string, string>
): string {
    const rawValue = getRawTaskPropertyValue(task, columnId, columns, assignments, resourceMap);
    const column = columns.find(c => c.id === columnId);
    if (rawValue === null || rawValue === undefined) return '';

    const dateColumns = ['start', 'finish', 'constraintDate'];
    if (dateColumns.includes(columnId) && rawValue) {
        return format(new Date(rawValue), 'MMM d, yyyy');
    }

    if (['totalFloat', 'freeFloat', 'slack'].includes(column?.id || '')) return rawValue !== null ? `${rawValue}d` : '';
    if (column?.id === 'duration') return `${rawValue} day(s)`;
    if (column?.id === 'percentComplete') return `${rawValue}%`;

    return String(rawValue);
}
