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

            // A summary task is critical if any of its children are critical.
            summaryTask.isCritical = children.some(c => c.isCritical);
            
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
            summaryTask.isCritical = false;
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
        // Reset critical path fields
        task.isCritical = false;
        task.totalFloat = undefined;
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
        return tasks;
    }

    // Forward pass: Calculate Early Start (ES) and Early Finish (EF)
    for (const taskId of sortedTasks) {
        const task = taskMap.get(taskId)!;

        // Reset conflict flags
        task.schedulingConflict = false;
        task.deadlineMissed = false;
        
        if (task.isSummary) continue;

        // --- Calculate Early Start from Predecessors ---
        let predecessorDrivenStart = new Date(0);
        const predecessorLinks = predecessorsMap.get(taskId) || [];
        
        if(predecessorLinks.length > 0) {
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
                if (potentialStart > predecessorDrivenStart) {
                    predecessorDrivenStart = potentialStart;
                }
            }
        } else {
             predecessorDrivenStart = task.start; // If no predecessors, respect its own start date
        }

        let earlyStart = predecessorDrivenStart;

        // --- Apply Constraints ---
        const { constraintType, constraintDate, duration } = task;

        if (constraintType && constraintDate) {
             const workingDuration = duration > 0 ? duration - 1 : 0;
             switch (constraintType) {
                case 'Must Start On':
                    earlyStart = startOfDay(constraintDate);
                    break;
                case 'Must Finish On':
                    earlyStart = calendarService.addWorkingDays(startOfDay(constraintDate), -workingDuration, calendar);
                    break;
                case 'Start No Earlier Than':
                    earlyStart = max([earlyStart, startOfDay(constraintDate)]);
                    break;
                case 'Finish No Earlier Than':
                    const requiredStartForFNET = calendarService.addWorkingDays(startOfDay(constraintDate), -workingDuration, calendar);
                    earlyStart = max([earlyStart, requiredStartForFNET]);
                    break;
             }
        }
        
        task.start = calendarService.isWorkingDay(earlyStart, calendar) ? earlyStart : calendarService.findNextWorkingDay(earlyStart, calendar);
        task.finish = calendarService.addWorkingDays(task.start, duration > 0 ? duration - 1 : 0, calendar);

        // --- Post-calculation validation for conflicts and deadlines ---
         if (constraintType && constraintDate) {
            switch (constraintType) {
                case 'Start No Later Than':
                    if (task.start > startOfDay(constraintDate)) {
                        task.schedulingConflict = true;
                    }
                    break;
                case 'Finish No Later Than':
                    if (task.finish > startOfDay(constraintDate)) {
                        task.schedulingConflict = true;
                    }
                    break;
            }
        }
        if (task.deadline && task.finish > startOfDay(task.deadline)) {
            task.deadlineMissed = true;
        }
    }
    
    // Backward Pass: Calculate Late Start (LS) and Late Finish (LF)
    const reversedSortedTasks = [...sortedTasks].reverse();
    const relevantTasks = Array.from(taskMap.values()).filter(t => !t.isSummary && t.finish);
    const projectFinishDate = relevantTasks.length > 0 ? new Date(Math.max(...relevantTasks.map(t => t.finish.getTime()))) : new Date();

    // Initialize LF for all tasks.
    for (const task of taskMap.values()) {
        task.lateFinish = projectFinishDate;
    }
    
    for (const taskId of reversedSortedTasks) {
        const task = taskMap.get(taskId)!;
        if (task.isSummary) continue;

        const successors = successorsMap.get(taskId) || [];
        if (successors.length > 0) {
            const potentialLateFinishes = successors.map(link => {
                const successorTask = taskMap.get(link.target)!;
                const successorLateFinish = successorTask.lateFinish!;
                const successorLateStart = successorTask.lateStart!;
                
                let constrainedLateFinish: Date;
                switch (link.type) {
                    case 'FS': // Finish-to-Start
                        constrainedLateFinish = calendarService.addWorkingDays(successorLateStart, -(link.lag + 1), calendar);
                        break;
                    case 'FF': // Finish-to-Finish
                        constrainedLateFinish = calendarService.addWorkingDays(successorLateFinish, -link.lag, calendar);
                        break;
                    case 'SS': // Start-to-Start
                        const tempLS_ss = calendarService.addWorkingDays(successorLateStart, -link.lag, calendar);
                        constrainedLateFinish = calendarService.addWorkingDays(tempLS_ss, task.duration > 0 ? task.duration - 1 : 0, calendar);
                        break;
                    case 'SF': // Start-to-Finish
                        const tempLS_sf = calendarService.addWorkingDays(successorLateFinish, -link.lag, calendar);
                        constrainedLateFinish = calendarService.addWorkingDays(tempLS_sf, task.duration > 0 ? task.duration - 1 : 0, calendar);
                        break;
                    default:
                        constrainedLateFinish = projectFinishDate;
                }
                return constrainedLateFinish;
            });
            task.lateFinish = new Date(Math.min(...potentialLateFinishes.map(d => d.getTime())));
        }
        
        task.lateStart = calendarService.addWorkingDays(task.lateFinish!, -(task.duration > 0 ? task.duration - 1 : 0), calendar);
    }
    
    // Calculate Float and Critical Path
    for (const taskId of sortedTasks) {
        const task = taskMap.get(taskId)!;
        if (task.isSummary) continue;
        if (task.lateStart && task.start) {
            task.totalFloat = calendarService.getWorkingDaysDuration(task.start, task.lateStart, calendar) - 1;
        } else {
            task.totalFloat = 0;
        }
        task.isCritical = task.totalFloat <= 0;
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
