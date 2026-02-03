import { Task, ColumnSpec, Assignment, Resource } from './types';
import { getTaskPropertyValue } from './task-utils';
import * as XLSX from 'xlsx';

function prepareData(
    tasks: Task[],
    columns: ColumnSpec[],
    visibleColumnIds: string[],
    assignments: Assignment[],
    resources: Resource[]
) {
    const resourceMap = new Map(resources.map(r => [r.id, r.name]));

    // Get visible columns objects in order
    const visibleColumns = visibleColumnIds
        .map(id => columns.find(c => c.id === id))
        .filter((c): c is ColumnSpec => !!c);

    const header = visibleColumns.map(c => c.name);

    const data = tasks.map(task => {
        return visibleColumns.map(col => {
            return getTaskPropertyValue(task, col.id, columns, assignments, resourceMap);
        });
    });

    return { header, data };
}

export function exportToCSV(
    tasks: Task[],
    columns: ColumnSpec[],
    visibleColumnIds: string[],
    assignments: Assignment[],
    resources: Resource[],
    filename: string
) {
    const { header, data } = prepareData(tasks, columns, visibleColumnIds, assignments, resources);

    const escapeCsv = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    };

    const csvContent = [
        header.map(escapeCsv).join(','),
        ...data.map(row => row.map(escapeCsv).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function exportToExcel(
    tasks: Task[],
    columns: ColumnSpec[],
    visibleColumnIds: string[],
    assignments: Assignment[],
    resources: Resource[],
    filename: string
) {
    const { header, data } = prepareData(tasks, columns, visibleColumnIds, assignments, resources);

    const worksheetData = [header, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

    XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
