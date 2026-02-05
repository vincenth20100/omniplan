import type { Task, Resource, Assignment, Calendar, ResourceUsageRow } from '@/lib/types';
import {
    startOfDay,
    addDays,
    format,
} from 'date-fns';
import { calendarService } from '@/lib/calendar';

export const calculateResourceUsage = (
    tasks: Task[],
    resources: Resource[],
    assignments: Assignment[],
    calendar: Calendar | null,
    startDate: Date,
    endDate: Date
): ResourceUsageRow[] => {
    const rows: ResourceUsageRow[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    resources.forEach(resource => {
        const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);

        // Calculate Task Rows for this Resource
        const taskRows: ResourceUsageRow[] = [];
        let resourceTotalWork = 0;
        const resourceDailyWork: Record<string, number> = {};

        resourceAssignments.forEach(assignment => {
            const task = taskMap.get(assignment.taskId);
            if (!task) return;

            const units = assignment.units || 1;
            const taskDailyWork: Record<string, number> = {};
            let taskTotalWork = 0;

            const taskStart = startOfDay(task.start);
            const taskFinish = startOfDay(task.finish);

            // Iterate days from start to finish
            let current = taskStart;
            while (current <= taskFinish) {
                if (!calendar || calendarService.isWorkingDay(current, calendar)) {
                    const hours = 8 * units;
                    const dateKey = format(current, 'yyyy-MM-dd');

                    taskDailyWork[dateKey] = hours;
                    taskTotalWork += hours;

                    // Add to resource totals
                    resourceDailyWork[dateKey] = (resourceDailyWork[dateKey] || 0) + hours;
                    resourceTotalWork += hours;
                }
                current = addDays(current, 1);
            }

            taskRows.push({
                id: `res-${resource.id}-task-${task.id}`,
                type: 'task',
                data: task,
                resourceId: resource.id,
                name: task.name,
                totalWork: taskTotalWork,
                dailyWork: taskDailyWork,
                level: 1,
                assignments: [assignment]
            });
        });

        // Add Resource Row
        rows.push({
            id: resource.id,
            type: 'resource',
            data: resource,
            resourceId: resource.id,
            name: resource.name,
            totalWork: resourceTotalWork,
            dailyWork: resourceDailyWork,
            level: 0,
            isExpanded: true // Default expanded
        });

        rows.push(...taskRows);
    });

    return rows;
};
