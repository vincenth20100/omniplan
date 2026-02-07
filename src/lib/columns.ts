'use client';
import type { ColumnSpec } from './types';

export const ALL_COLUMNS: (Omit<ColumnSpec, 'width'> & { defaultWidth: number })[] = [
    { id: 'wbs', name: 'WBS', defaultWidth: 50, type: 'text' },
    { id: 'projectSource', name: 'Project Source', defaultWidth: 150, type: 'text' },
    { id: 'schedulingMode', name: 'I', defaultWidth: 30, type: 'text' },
    { id: 'name', name: 'Task Name', defaultWidth: 250, type: 'text' },
    { id: 'effortDriven', name: 'Effort Driven', defaultWidth: 80, type: 'selection' },
    { id: 'duration', name: 'Duration', defaultWidth: 80, type: 'number' },
    { id: 'work', name: 'Work', defaultWidth: 80, type: 'number' },
    { id: 'status', name: 'Status', defaultWidth: 120, type: 'selection', options: ['To Do', 'In Progress', 'Done'] },
    { id: 'resourceNames', name: 'Resource Names', defaultWidth: 150, type: 'text' },
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
    { id: 'baselineDuration', name: 'Baseline Duration', defaultWidth: 80, type: 'number' },
    { id: 'baselineStart', name: 'Baseline Start', defaultWidth: 110, type: 'date' },
    { id: 'baselineFinish', name: 'Baseline Finish', defaultWidth: 110, type: 'date' },
    { id: 'finishVariance', name: 'Finish Variance', defaultWidth: 80, type: 'number' },
    { id: 'isCritical', name: 'C', defaultWidth: 40, type: 'text' },
    { id: 'totalFloat', name: 'Float', defaultWidth: 80, type: 'number' },
    { id: 'calendar', name: 'Calendar', defaultWidth: 150, type: 'selection' },
    { id: 'lastComment', name: 'Last Comment', defaultWidth: 200, type: 'text' },
];

export const initialColumns: ColumnSpec[] = ALL_COLUMNS.map(c => {
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

export const initialVisibleColumns = ['wbs', 'schedulingMode', 'name', 'duration', 'start', 'finish'];

    
