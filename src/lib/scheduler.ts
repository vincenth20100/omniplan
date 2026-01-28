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
            summaryTask.durationUnit = 'd'; // Summary duration is always in working days
            summaryTask.cost = children.reduce((acc, c) => acc + (c.cost || 0), 0);
            
            const childrenTotalWork = children.reduce((acc, c) => {
                // For simplicity, assume duration is a proxy for work. A more complex model could use work hours.
                return acc + ((c.duration || 0) * (c.durationUnit === 'd' ? 1 : 0)); // Only count work days
            }, 0);

            if (childrenTotalWork > 0) {
                 summaryTask.percentComplete = Math.round(children.reduce((acc, c) => {
                    const work = (c.duration || 0) * (c.durationUnit === 'd' ? 1 : 0);
                    return acc + ((c.percentComplete || 0) * work);
                }, 0) / childrenTotalWork);
            } else {
                // If no children have work duration, average their percent complete.
                summaryTask.percentComplete = children.length > 0 ? children.reduce((acc, c) => acc + (c.percentComplete || 0), 0) / children.length : 0;
            }

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
    
    // Only perform topological sort on non-summary tasks
    const schedulableTasks = tasks.filter(t => !t.isSummary);

    for (const task of schedulableTasks) {
        predecessorsMap.set(task.id, []);
        successorsMap.set(task.id, []);
        inDegree.set(task.id, 0);
        // Reset critical path fields
        task.isCritical = false;
        task.totalFloat = undefined;
    }

    // A map from parentId to list of its children task IDs
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
            // "Exit" tasks are those children that are not a source of any link within the group
            const exitTasks = childrenIds.filter(childId => 
                !links.some(l => l.source === childId && childrenIds.includes(l.target))
            );
            effectiveSources = exitTasks.length > 0 ? exitTasks : childrenIds; // Fallback to all children if cycle or all linked
        }

        let effectiveTargets = [link.target];
        if (targetTask.isSummary) {
            const childrenIds = childrenMap.get(targetTask.id) || [];
            // "Entry" tasks are those children that are not a target of any link within the group
            const entryTasks = childrenIds.filter(childId => 
                !links.some(l => l.target === childId && childrenIds.includes(l.source))
            );
            effectiveTargets = entryTasks.length > 0 ? entryTasks : childrenIds; // Fallback to all children
        }
        
        effectiveSources.forEach(sId => {
            effectiveTargets.forEach(tId => {
                const sTask = taskMap.get(sId);
                const tTask = taskMap.get(tId);
                // Only add links between actual schedulable tasks
                if (sTask && !sTask.isSummary && tTask && !tTask.isSummary) {
                    expandedLinks.push({ ...link, source: sId, target: tId });
                }
            });
        });
    });

    for (const link of expandedLinks) {
        if (successorsMap.has(link.source)) {
            successorsMap.get(link.source)!.push(link);
        }
        if (predecessorsMap.has(link.target)) {
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
    
    if (sortedTasks.length !== schedulableTasks.length) {
        console.warn("Scheduling conflict detected: A circular dependency exists in your project links. The schedule may be incorrect until the cycle is removed.");
        // We don't return here, we try to schedule what we can.
    }

    // Forward pass: Calculate Early Start (ES) and Early Finish (EF)
    for (const taskId of sortedTasks) {
        const task = taskMap.get(taskId)!;

        // Reset conflict flags
        task.schedulingConflict = false;
        task.deadlineMissed = false;
        
        // This is already filtered by sortedTasks, but as a safeguard.
        if (task.isSummary) continue;

        // If a task has progress, its start date is fixed.
        if ((task.percentComplete || 0) > 0) {
            task.finish = calendarService.calculateFinishDate(task.start, task.duration, task.durationUnit || 'd', calendar);
            
            if (task.deadline && task.finish > startOfDay(task.deadline)) {
                task.deadlineMissed = true;
            }
            continue; // Skip rescheduling for tasks in progress.
        }

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
                        const tempFinishFF = calendarService.addWorkingDays(sourceTask.finish, link.lag, calendar);
                        const durationValue = task.duration > 0 ? task.duration - 1 : 0;
                        potentialStart = calendarService.addWorkingDays(tempFinishFF, -durationValue, calendar);
                        break;
                    case 'SF':
                         const tempFinishSF = calendarService.addWorkingDays(sourceTask.start, link.lag, calendar);
                         const sfDurationValue = task.duration > 0 ? task.duration - 1 : 0;
                         potentialStart = calendarService.addWorkingDays(tempFinishSF, -sfDurationValue, calendar);
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
        const { constraintType, constraintDate, duration, durationUnit } = task;
        const durationForCalc = duration > 0 ? duration - 1 : 0;

        if (constraintType && constraintDate) {
             switch (constraintType) {
                case 'Must Start On':
                    earlyStart = startOfDay(constraintDate);
                    break;
                case 'Must Finish On':
                    earlyStart = calendarService.addWorkingDays(startOfDay(constraintDate), -durationForCalc, calendar);
                    break;
                case 'Start No Earlier Than':
                    earlyStart = max([earlyStart, startOfDay(constraintDate)]);
                    break;
                case 'Finish No Earlier Than':
                    const requiredStartForFNET = calendarService.addWorkingDays(startOfDay(constraintDate), -durationForCalc, calendar);
                    earlyStart = max([earlyStart, requiredStartForFNET]);
                    break;
             }
        }
        
        task.start = calendarService.isWorkingDay(earlyStart, calendar) ? earlyStart : calendarService.findNextWorkingDay(earlyStart, calendar);
        task.finish = calendarService.calculateFinishDate(task.start, duration, durationUnit || 'd', calendar);

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

        let lateFinish = projectFinishDate; // Start with project end

        const successors = successorsMap.get(taskId) || [];
        if (successors.length > 0) {
            const potentialLateFinishes = successors.map(link => {
                const successorTask = taskMap.get(link.target)!;
                const successorLateStart = successorTask.lateStart;
                
                if (!successorLateStart) {
                    return projectFinishDate;
                }

                let constrainedLateFinish: Date;
                switch (link.type) {
                    case 'FS': // Finish-to-Start
                        constrainedLateFinish = calendarService.addWorkingDays(successorLateStart, -(link.lag + 1), calendar);
                        break;
                    case 'FF': // Finish-to-Finish
                        constrainedLateFinish = calendarService.addWorkingDays(successorTask.lateFinish!, -link.lag, calendar);
                        break;
                    case 'SS': // Start-to-Start
                        const tempLS_ss = calendarService.addWorkingDays(successorLateStart, -link.lag, calendar);
                        constrainedLateFinish = calendarService.calculateFinishDate(tempLS_ss, task.duration, task.durationUnit || 'd', calendar);
                        break;
                    case 'SF': // Start-to-Finish - this logic is complex, fallback to avoid errors
                    default:
                        constrainedLateFinish = projectFinishDate;
                }
                return constrainedLateFinish;
            });
            lateFinish = new Date(Math.min(...potentialLateFinishes.map(d => d.getTime())));
        }
        
        // Also constrain by the task's own deadline or late-finish constraints
        if (task.constraintType && task.constraintDate) {
            if (task.constraintType === 'Finish No Later Than' || task.constraintType === 'Must Finish On') {
                lateFinish = new Date(Math.min(lateFinish.getTime(), startOfDay(task.constraintDate).getTime()));
            }
        }
        if (task.deadline) {
            lateFinish = new Date(Math.min(lateFinish.getTime(), startOfDay(task.deadline).getTime()));
        }

        task.lateFinish = lateFinish;
        const durationForCalc = task.duration > 0 ? task.duration - 1 : 0;
        task.lateStart = calendarService.addWorkingDays(task.lateFinish!, -durationForCalc, calendar);
         if (task.constraintType === 'Must Start On' && task.constraintDate) {
            task.lateStart = new Date(Math.min(task.lateStart.getTime(), startOfDay(task.constraintDate).getTime()));
        }
    }
    
    // Calculate Float and Critical Path
    for (const taskId of sortedTasks) {
        const task = taskMap.get(taskId)!;
        if (task.isSummary) continue;
        if (task.lateStart && task.start) {
            task.totalFloat = calendarService.getWorkingDaysDuration(task.start, task.lateStart, calendar);
             if (task.totalFloat > 0) task.totalFloat -= 1;
        } else {
            task.totalFloat = 0;
        }
        task.isCritical = task.totalFloat <= 0;
    }

    // Update driving status on links
    for(const link of expandedLinks) {
        const originalLink = links.find(l => link.id.startsWith(l.id));
        if (!originalLink) continue;
        
        originalLink.isDriving = false;
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
                 const tempFinishFF = calendarService.addWorkingDays(sourceTask.finish, link.lag, calendar);
                 const durationValue = targetTask.duration > 0 ? targetTask.duration - 1 : 0;
                 potentialStart = calendarService.addWorkingDays(tempFinishFF, -durationValue, calendar);
                break;
            case 'SF':
                 const tempFinishSF = calendarService.addWorkingDays(sourceTask.start, link.lag, calendar);
                 const sfDurationValue = targetTask.duration > 0 ? targetTask.duration - 1 : 0;
                 potentialStart = calendarService.addWorkingDays(tempFinishSF, -sfDurationValue, calendar);
                break;
            default:
                potentialStart = new Date(0);
        }
        potentialStart = calendarService.isWorkingDay(potentialStart, calendar) ? potentialStart : calendarService.findNextWorkingDay(potentialStart, calendar);
        
        // This is a simplified check. A more robust check would consider all predecessors.
        if (potentialStart.getTime() >= targetTask.start.getTime()) {
             originalLink.isDriving = true;
        }
    }
    
    // Update summary tasks
    const finalTasksWithSummaries = updateAllSummaryTasks(Array.from(taskMap.values()), links, columns, calendar);
    
    // Sort final task list by WBS to maintain original-like order in the UI
    finalTasksWithSummaries.sort((a, b) => (a.wbs || '').localeCompare(b.wbs || '', undefined, { numeric: true, sensitivity: 'base' }));

    return finalTasksWithSummaries;
}
