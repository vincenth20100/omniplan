'use client';
import React, { useState, useMemo } from 'react';
import { ProjectState, UiDensity, ResourceUsageRow, Resource } from '@/lib/types';
import { ResourceTable } from '@/components/resources/resource-table';
import { calculateResourceUsage } from '@/lib/resource-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { min, max, addDays, startOfDay } from 'date-fns';

interface TaskResourceTablePanelProps {
    projectState: ProjectState;
    uiDensity: UiDensity;
}

export function TaskResourceTablePanel({ projectState, uiDensity }: TaskResourceTablePanelProps) {
    const isMobile = useIsMobile();
    const { tasks, resources, assignments, calendars, defaultCalendarId } = projectState;
    const defaultCalendar = useMemo(() => calendars.find(c => c.id === defaultCalendarId) || (calendars.length > 0 ? calendars[0] : null), [calendars, defaultCalendarId]);

    const [expandedResourceIds, setExpandedResourceIds] = useState<Set<string>>(new Set(resources.map(r => r.id)));

    // Sort & Filter state
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});

    const viewRange = useMemo(() => {
        if (tasks.length > 0) {
            const minDate = min(tasks.map(t => t.start));
            const maxDate = max(tasks.map(t => t.finish));
            return {
                start: addDays(startOfDay(minDate), -7),
                end: addDays(startOfDay(maxDate), 7)
            };
        } else {
             const today = startOfDay(new Date());
             return {
                 start: addDays(today, -7),
                 end: addDays(today, 21)
             };
        }
    }, [tasks]);

    const usageData = useMemo(() => {
        if (!viewRange) return [];
        return calculateResourceUsage(tasks, resources, assignments, defaultCalendar, viewRange.start, viewRange.end);
    }, [tasks, resources, assignments, defaultCalendar, viewRange]);

    const visibleRows = useMemo(() => {
        // 1. Group by resource
        const groups: { resource: ResourceUsageRow, tasks: ResourceUsageRow[] }[] = [];
        let currentGroup: { resource: ResourceUsageRow, tasks: ResourceUsageRow[] } | null = null;

        usageData.forEach(row => {
            if (row.type === 'resource') {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = { resource: row, tasks: [] };
            } else if (currentGroup && row.type === 'task') {
                currentGroup.tasks.push(row);
            }
        });
        if (currentGroup) groups.push(currentGroup);

        // 2. Filter
        let filteredGroups = groups.filter(group => {
            if (filters.name && !group.resource.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
            if (filters.type && (group.resource.data as Resource).type.toLowerCase() !== filters.type.toLowerCase()) return false;
            return true;
        });

        // 3. Sort
        if (sortColumn && sortDirection) {
            filteredGroups.sort((a, b) => {
                let valA: any = '';
                let valB: any = '';

                if (sortColumn === 'name') {
                    valA = a.resource.name;
                    valB = b.resource.name;
                } else if (sortColumn === 'type') {
                    valA = (a.resource.data as Resource).type;
                    valB = (b.resource.data as Resource).type;
                } else if (sortColumn === 'maxUnits') {
                    valA = (a.resource.data as Resource).availability || 1;
                    valB = (b.resource.data as Resource).availability || 1;
                } else if (sortColumn === 'totalWork') {
                    valA = a.resource.totalWork;
                    valB = b.resource.totalWork;
                }

                if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // 4. Flatten
        const flatRows: ResourceUsageRow[] = [];
        filteredGroups.forEach(group => {
            flatRows.push(group.resource);
            if (expandedResourceIds.has(group.resource.resourceId)) {
                flatRows.push(...group.tasks);
            }
        });

        return flatRows;
    }, [usageData, expandedResourceIds, sortColumn, sortDirection, filters]);

    const handleSort = (columnId: string) => {
        if (sortColumn === columnId) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
            if (sortDirection === 'desc') setSortColumn(null);
        } else {
            setSortColumn(columnId);
            setSortDirection('asc');
        }
    };

    const handleFilterChange = (columnId: string, value: string) => {
        setFilters(prev => ({ ...prev, [columnId]: value }));
    };

    const toggleExpand = (resourceId: string) => {
        const newSet = new Set(expandedResourceIds);
        if (newSet.has(resourceId)) {
            newSet.delete(resourceId);
        } else {
            newSet.add(resourceId);
        }
        setExpandedResourceIds(newSet);
    };

    return (
        <div className={cn(
            "h-full flex flex-col",
            (uiDensity === 'large' && !isMobile) && 'p-4',
            (uiDensity === 'medium' && !isMobile) && 'p-3',
            (uiDensity === 'compact' || isMobile) && 'p-2'
        )}>
           <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-background">
               <ResourceTable
                    rows={visibleRows}
                    expandedResourceIds={expandedResourceIds}
                    onToggleExpand={toggleExpand}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                />
           </div>
        </div>
    );
}
