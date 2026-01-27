'use client';
import type { Task, Link, ColumnSpec, Calendar } from './types';
import { calendarService } from './calendar';
import { startOfDay, max } from 'date-fns';

function updateAllSummaryTasks(tasks: Task[], links: Link[], columns: ColumnSpec[] | undefined, calendar: Calendar): Task[] {
    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
    
    // Create a map of children for each parent
    const childrenMap = new Map<string, Task[]>();
    for (const task of taskMap.values()) {
        if (task.parentId) {
            if (!childrenMap.has(task.parentId)) {
                childrenMap.set(task.parentId, []);
            }
            childrenMap.get(task.parentId)!.push(task);
        }
    }

    // Get all summary tasks
    const summaryTasks = Array.from(taskMap.values()).filter(t => t.isSummary);
    
    // Sort summary tasks by level, deepest first
    summaryTasks.sort((a, b) => (b.level || 0) - (a.level || 0));

    for (const summaryTask of summaryTasks) {
        const children = childrenMap.get(summaryTask.id) || [];
        
        if (children.length > 0) {
            summaryTask.start = new Date(Math.min(...children.map(c => c.start.getTime())));
            summaryTask.finish = new Date(Math.max(...children.map(c => c.finish.getTime())));
            summaryTask.duration = calendarService.getWorkingDaysDuration(summaryTask.start, summaryTask.finish, calendar);
            summaryTask.cost = children.reduce((acc, c) => acc + (c.cost || 0), 0);
            
            const childrenTotalDuration = children.reduce((acc, c) => acc + (c.duration || 0), 0);
            summaryTask.percentComplete = childrenTotalDuration > 0
                ? Math.round(children.reduce((acc, c) => acc + ((c.percentComplete || 0) * (c.duration || 0)), 0) / childrenTotalDuration)
                : 0;
            
            if (columns) {
                columns.forEach(col => {
                    if (col.id.startsWith('custom-') && col.type === 'number') {
                        const sum = children.reduce((acc, c) => acc + (Number(c.customAttributes?.[col.id]) || 0), 0);
                        if (!summaryTask.customAttributes) summaryTask.customAttributes = {};
                        summaryTask.customAttributes[col.id] = sum;
                    }
                });
            }

        } else { // Summary task with no children should have zeroed-out values
            summaryTask.duration = 0;
            summaryTask.finish = summaryTask.start;
            summaryTask.percentComplete = 100; // No children to complete
            summaryTask.cost = 0;
        }

        taskMap.set(summaryTask.id, summaryTask);
    }
    
    return Array.from(taskMap.values());
}


export function calculateSchedule(tasks: Task[], links: Link[], columns: ColumnSpec[] | undefined, calendar: Calendar): Task[] {
    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
    const predecessorsMap = new Map<string, Link[]>();
    const successorsMap = new Map<string, Link[]>();
    const inDegree = new Map<string, number>();

    for (const task of tasks) {
        predecessorsMap.set(task.id, []);
        successorsMap.set(task.id, []);
        inDegree.set(task.id, 0);
    }

    for (const link of links) {
        if (taskMap.has(link.source) && taskMap.has(link.target)) {
            successorsMap.get(link.source)!.push(link);
            predecessorsMap.get(link.target)!.push(link);
            inDegree.set(link.target, (inDegree.get(link.target) || 0) + 1);
        }
    }

    const queue: string[] = [];
    for (const [taskId, degree] of inDegree.entries()) {
        if (degree === 0) {
            queue.push(taskId);
        }
    }

    const sortedTasks: string[] = [];
    while (queue.length > 0) {
        const taskId = queue.shift()!;
        sortedTasks.push(taskId);

        const successors = successorsMap.get(taskId) || [];
        for (const link of successors) {
            const targetId = link.target;
            const currentInDegree = (inDegree.get(targetId) || 0) - 1;
            inDegree.set(targetId, currentInDegree);
            if (currentInDegree === 0) {
                queue.push(targetId);
            }
        }
    }
    
    if (sortedTasks.length !== tasks.length) {
        console.error("Scheduling conflict detected: A circular dependency exists in your project links.");
        // Return original tasks to prevent further errors, maybe flag the cyclic tasks
        return tasks;
    }

    // Forward pass: Calculate Early Start (ES) and Early Finish (EF)
    for (const taskId of sortedTasks) {
        const task = taskMap.get(taskId)!;
        
        const predecessorLinks = predecessorsMap.get(taskId) || [];
        
        let earlyStart = task.start;

        if(predecessorLinks.length > 0) {
            earlyStart = new Date(0); // Start from the beginning of time
            for(const link of predecessorLinks) {
                const sourceTask = taskMap.get(link.source)!;
                let potentialStart: Date;
                 switch (link.type) {
                    case 'FS':
                        potentialStart = calendarService.addWorkingDays(sourceTask.finish, link.lag + 1, calendar);
                        break;
                    case 'SS':
                        potentialStart = calendarService.addWorkingDays(sourceTask.start, link.lag, calendar);
                        break;
                    case 'FF':
                        potentialStart = calendarService.addWorkingDays(sourceTask.finish, link.lag - (task.duration > 0 ? task.duration - 1 : 0), calendar);
                        break;
                    case 'SF':
                        potentialStart = calendarService.addWorkingDays(sourceTask.start, link.lag - (task.duration > 0 ? task.duration - 1 : 0), calendar);
                        break;
                    default:
                        potentialStart = new Date(0);
                }
                if (potentialStart > earlyStart) {
                    earlyStart = potentialStart;
                }
            }
        }

        // Apply constraints
        if (task.constraintType === 'Must Start On' && task.constraintDate) {
            earlyStart = max([earlyStart, startOfDay(task.constraintDate)]);
        } else if (task.constraintType === 'Start No Earlier Than' && task.constraintDate) {
            earlyStart = max([earlyStart, startOfDay(task.constraintDate)]);
        }

        task.start = calendarService.isWorkingDay(earlyStart, calendar) ? earlyStart : calendarService.findNextWorkingDay(earlyStart, calendar);
        task.finish = calendarService.addWorkingDays(task.start, task.duration > 0 ? task.duration - 1 : 0, calendar);
    }
    
    // Update driving status on links
    for(const link of links) {
        link.isDriving = false;
        const targetTask = taskMap.get(link.target);
        const sourceTask = taskMap.get(link.source);
        if (!targetTask || !sourceTask) continue;
        
        let potentialStart: Date;
        switch (link.type) {
            case 'FS':
                potentialStart = calendarService.addWorkingDays(sourceTask.finish, link.lag + 1, calendar);
                break;
            case 'SS':
                potentialStart = calendarService.addWorkingDays(sourceTask.start, link.lag, calendar);
                break;
            case 'FF':
                 potentialStart = calendarService.addWorkingDays(sourceTask.finish, link.lag - (targetTask.duration > 0 ? targetTask.duration - 1 : 0), calendar);
                break;
            case 'SF':
                 potentialStart = calendarService.addWorkingDays(sourceTask.start, link.lag - (targetTask.duration > 0 ? targetTask.duration - 1 : 0), calendar);
                break;
            default:
                potentialStart = new Date(0);
        }
        potentialStart = calendarService.isWorkingDay(potentialStart, calendar) ? potentialStart : calendarService.findNextWorkingDay(potentialStart, calendar);
        
        if (potentialStart.getTime() >= targetTask.start.getTime()) {
             link.isDriving = true;
        }
    }
    
    // Update summary tasks
    const finalTasksWithSummaries = updateAllSummaryTasks(Array.from(taskMap.values()), links, columns, calendar);
    
    // Sort final task list by WBS to maintain original-like order in the UI
    finalTasksWithSummaries.sort((a, b) => (a.wbs || '').localeCompare(b.wbs || '', undefined, { numeric: true, sensitivity: 'base' }));

    return finalTasksWithSummaries;
}
