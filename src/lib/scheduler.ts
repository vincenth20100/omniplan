'use client';
import type { Task, Link, ColumnSpec, Calendar, Assignment, Resource } from './types';
import { calendarService } from './calendar';
import { startOfDay, max, addYears } from 'date-fns';

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
            
            // Aggregate criticalFor from children
            const childCriticalFor = new Set<string>();
            children.forEach(c => {
                if (c.criticalFor) {
                    c.criticalFor.forEach(pid => childCriticalFor.add(pid));
                }
            });
            summaryTask.criticalFor = Array.from(childCriticalFor);

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


export function calculateSchedule(tasks: Task[], links: Link[], columns: ColumnSpec[] | undefined, calendar: Calendar, assignments: Assignment[] = [], resources: Resource[] = [], calendars: Calendar[] = []): Task[] {
    const taskMap = new Map<string, Task>(tasks.map(task => [task.id, { ...task }]));
    const predecessorsMap = new Map<string, Link[]>();
    const successorsMap = new Map<string, Link[]>();
    const inDegree = new Map<string, number>();
    const taskCalendarMap = new Map<string, Calendar>();
    
    // Determine effective calendar for each task
    for (const task of tasks) {
        let effectiveCalendar = calendar; // Default to project calendar
        let conflictMsg: string | undefined = undefined;

        // Check for assigned resources
        const taskAssignments = assignments.filter(a => a.taskId === task.id);
        if (taskAssignments.length > 0) {
            const assignedResources = taskAssignments.map(a => resources.find(r => r.id === a.resourceId)).filter(Boolean) as Resource[];

            // Get unique calendar IDs from resources
            // If resource has no calendarId, it implies project default? Or undefined?
            // "The ressources shall then also for each have a possibility to specify a specific calendar."
            // Assuming fallback to project calendar if not specified.
            const resourceCalendars = assignedResources.map(r => {
                if (r.calendarId) {
                    return calendars.find(c => c.id === r.calendarId) || calendar;
                }
                return calendar;
            });

            // Deduplicate based on ID
            const uniqueCalendars = Array.from(new Map(resourceCalendars.map(c => [c.id, c])).values());

            if (uniqueCalendars.length === 1) {
                effectiveCalendar = uniqueCalendars[0];
            } else if (uniqueCalendars.length > 1) {
                conflictMsg = "Multiple resources with different calendars assigned. Using the most restrictive calendar.";

                // Find the one with least working days in a sample year
                const sampleStart = new Date();
                const sampleEnd = addYears(sampleStart, 1);

                let minWorkingDays = Infinity;
                let mostRestrictiveCal = uniqueCalendars[0];

                for (const cal of uniqueCalendars) {
                    const workingDays = calendarService.getWorkingDaysDuration(sampleStart, sampleEnd, cal);
                    if (workingDays < minWorkingDays) {
                        minWorkingDays = workingDays;
                        mostRestrictiveCal = cal;
                    }
                }
                effectiveCalendar = mostRestrictiveCal;
            }
        } else {
            // No resources, check task specific calendar
            if (task.calendarId) {
                effectiveCalendar = calendars.find(c => c.id === task.calendarId) || calendar;
            }
        }

        task.effectiveCalendarId = effectiveCalendar.id;
        task.calendarConflict = conflictMsg;
        taskCalendarMap.set(task.id, effectiveCalendar);
    }

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
        return tasks;
    }

    // Forward pass: Calculate Early Start (ES) and Early Finish (EF)
    for (const taskId of sortedTasks) {
        const task = taskMap.get(taskId)!;

        // Reset conflict flags
        task.schedulingConflict = false;
        task.deadlineMissed = false;
        
        // This is already filtered by sortedTasks, but as a safeguard.
        if (task.isSummary) continue;

        // --- Calculate Early Start from Predecessors ---
        let predecessorDrivenStart = new Date(0);
        const predecessorLinks = predecessorsMap.get(taskId) || [];
        const taskCalendar = taskCalendarMap.get(taskId) || calendar;
        
        if(predecessorLinks.length > 0) {
            for(const link of predecessorLinks) {
                const sourceTask = taskMap.get(link.source)!;
                let potentialStart: Date;
                 switch (link.type) {
                    case 'FS':
                        potentialStart = calendarService.addWorkingDays(sourceTask.finish, link.lag + 1, taskCalendar);
                        break;
                    case 'SS':
                        potentialStart = calendarService.addWorkingDays(sourceTask.start, link.lag, taskCalendar);
                        break;
                    case 'FF':
                        const tempFinishFF = calendarService.addWorkingDays(sourceTask.finish, link.lag, taskCalendar);
                        const durationValue = task.duration > 0 ? task.duration - 1 : 0;
                        potentialStart = calendarService.addWorkingDays(tempFinishFF, -durationValue, taskCalendar);
                        break;
                    case 'SF':
                         const tempFinishSF = calendarService.addWorkingDays(sourceTask.start, link.lag, taskCalendar);
                         const sfDurationValue = task.duration > 0 ? task.duration - 1 : 0;
                         potentialStart = calendarService.addWorkingDays(tempFinishSF, -sfDurationValue, taskCalendar);
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
                    earlyStart = calendarService.addWorkingDays(startOfDay(constraintDate), -durationForCalc, taskCalendar);
                    break;
                case 'Start No Earlier Than':
                    earlyStart = max([earlyStart, startOfDay(constraintDate)]);
                    break;
                case 'Finish No Earlier Than':
                    const requiredStartForFNET = calendarService.addWorkingDays(startOfDay(constraintDate), -durationForCalc, taskCalendar);
                    earlyStart = max([earlyStart, requiredStartForFNET]);
                    break;
             }
        }
        
        task.start = calendarService.isWorkingDay(earlyStart, taskCalendar) ? earlyStart : calendarService.findNextWorkingDay(earlyStart, taskCalendar);
        task.finish = calendarService.calculateFinishDate(task.start, duration, durationUnit || 'd', taskCalendar);

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
    const allRelevantTasks = Array.from(taskMap.values()).filter(t => !t.isSummary && t.finish);

    // Identify distinct projects
    const projectIds = Array.from(new Set(allRelevantTasks.map(t => t.projectId || 'default')));
    const projectFinishDates: Record<string, Date> = {};

    projectIds.forEach(pid => {
        const tasksInProject = allRelevantTasks.filter(t => (t.projectId || 'default') === pid);
        if (tasksInProject.length > 0) {
            projectFinishDates[pid] = new Date(Math.max(...tasksInProject.map(t => t.finish.getTime())));
        } else {
            projectFinishDates[pid] = new Date();
        }
    });

    // We calculate "Global" LS/LF (most constrained across all projects)
    // And "Critical For" list.

    // Initialize global LS/LF to extreme values
    const MAX_DATE = new Date(8640000000000000);
    for (const task of taskMap.values()) {
        task.lateFinish = MAX_DATE;
        task.lateStart = MAX_DATE;
        task.criticalFor = [];
    }

    // Run a backward pass for EACH project to determine criticality
    for (const targetPid of projectIds) {
        const targetFinishDate = projectFinishDates[targetPid];

        // Temporary map for this pass
        const passLFs = new Map<string, Date>();

        // Initialize sink nodes for this project
        // A sink node for project P is any task in P that finishes at P's finish date
        for (const task of allRelevantTasks) {
            if ((task.projectId || 'default') === targetPid && task.finish.getTime() === targetFinishDate.getTime()) {
                passLFs.set(task.id, targetFinishDate);
            } else {
                passLFs.set(task.id, MAX_DATE);
            }
        }

        for (const taskId of reversedSortedTasks) {
            const task = taskMap.get(taskId)!;
            if (task.isSummary) continue;

            let lateFinish = passLFs.get(taskId) || MAX_DATE;

            const successors = successorsMap.get(taskId) || [];
            if (successors.length > 0) {
                const potentialLateFinishes = successors.map(link => {
                    const successorTask = taskMap.get(link.target)!;
                    // We need the LS of the successor *for this pass*.
                    // But we calculate tasks in reverse topological order, so we haven't computed successor's LS yet?
                    // Wait, reverse topological order means we visit successors BEFORE predecessors.
                    // So successorTask has already been processed in this loop.
                    // We need to store LS for this pass.

                    // Let's store passLS as well.
                    // Re-structure: we calculate LS immediately after LF.

                    // We need to look up the computed LS of the successor from `passLS`.
                    // But `passLS` is derived from `passLFs`.
                    // Let's compute it on the fly or store it.

                    // To simplify:
                    //   Calculate my LF based on successors' LS.
                    //   Calculate my LS based on my LF.
                    //   Store my LS for my predecessors.

                    return MAX_DATE; // Placeholder, logic below handles this better
                });
            }

            // Re-implement logic: look at successors which have already been processed
            if (successors.length > 0) {
                 const potentialLFs = successors.map(link => {
                     const successorTask = taskMap.get(link.target)!;
                     // Retrieve successor's LS calculated in this pass.
                     // We need a map for it.
                     // Actually, we can just use `passLFs` of successor? No, that's its LF.
                     // We need its LS.
                     // Let's calculate its LS from its stored LF.
                     const sLF = passLFs.get(successorTask.id) || MAX_DATE;
                     if (sLF.getTime() === MAX_DATE.getTime()) return MAX_DATE;

                     const sDurationCalc = successorTask.duration > 0 ? successorTask.duration - 1 : 0;
                     // Successor calculation should use successor's calendar
                     const successorCalendar = taskCalendarMap.get(successorTask.id) || calendar;

                     let sLS = calendarService.addWorkingDays(sLF, -sDurationCalc, successorCalendar);
                     if (successorTask.constraintType === 'Must Start On' && successorTask.constraintDate) {
                        sLS = new Date(Math.min(sLS.getTime(), startOfDay(successorTask.constraintDate).getTime()));
                     }

                     let constrainedLateFinish: Date;
                     // The lag here is on the relationship.
                     // Standard is to use the successor's calendar for FS/SS (predecessor to successor).
                     // However, this is backward pass. We are calculating Predecessor LF from Successor LS/LF.
                     // The relationship math is inverse of forward pass.
                     // If FS: Succ.Start = Pred.Finish + Lag + 1 (in Succ Cal).
                     // So Pred.Finish = Succ.Start - Lag - 1 (in Succ Cal).
                     // So we use successorCalendar.

                     switch (link.type) {
                        case 'FS':
                            constrainedLateFinish = calendarService.addWorkingDays(sLS, -(link.lag + 1), successorCalendar);
                            break;
                        case 'FF':
                            constrainedLateFinish = calendarService.addWorkingDays(sLF, -link.lag, successorCalendar);
                            break;
                        case 'SS':
                            const tempLS_ss = calendarService.addWorkingDays(sLS, -link.lag, successorCalendar);
                            // This tempLS_ss is effectively where the SS link points to on the predecessor.
                            // But SS links Pred Start to Succ Start.
                            // Succ.Start = Pred.Start + Lag.
                            // Pred.Start = Succ.Start - Lag.
                            // We need Pred.Finish.
                            // Pred.Finish = Pred.Start + Pred.Duration.
                            // So Pred.Finish = (Succ.Start - Lag) + Pred.Duration.
                            // The lag is in Successor Calendar?
                            // Yes, usually lag follows successor.

                            // Re-calculating constrainedLateFinish is tricky here because it depends on Pred duration.
                            // The code above calculates Finish Date.
                            // constrainedLateFinish = CalculateFinish( (sLS - lag), task.duration ).
                            // This uses `task` (predecessor) duration, so we should use `task` calendar for the duration part.
                            // But the lag part uses successor calendar.

                            // Let's keep it simple and consistent with previous logic but apply calendars correctly.
                            // Current `task` here IS the predecessor. `calendar` was global.
                            // We need `taskCalendar` (predecessor) and `successorCalendar`.

                            // const tempLS_ss = calendarService.addWorkingDays(sLS, -link.lag, calendar); -> This is the lag part.
                            // constrainedLateFinish = calendarService.calculateFinishDate(tempLS_ss, task.duration, task.durationUnit || 'd', calendar); -> This is duration part.

                            const tempStart = calendarService.addWorkingDays(sLS, -link.lag, successorCalendar);
                            constrainedLateFinish = calendarService.calculateFinishDate(tempStart, task.duration, task.durationUnit || 'd', taskCalendarMap.get(task.id) || calendar);
                            break;
                        default:
                            constrainedLateFinish = MAX_DATE;
                    }
                    return constrainedLateFinish;
                 });
                 const minSuccLF = new Date(Math.min(...potentialLFs.map(d => d.getTime())));
                 if (minSuccLF.getTime() < lateFinish.getTime()) {
                     lateFinish = minSuccLF;
                 }
            }

            // Constraints
            if (task.constraintType && task.constraintDate) {
                if (task.constraintType === 'Finish No Later Than' || task.constraintType === 'Must Finish On') {
                    lateFinish = new Date(Math.min(lateFinish.getTime(), startOfDay(task.constraintDate).getTime()));
                }
            }
            if (task.deadline) {
                lateFinish = new Date(Math.min(lateFinish.getTime(), startOfDay(task.deadline).getTime()));
            }

            passLFs.set(taskId, lateFinish); // Store for my predecessors (implied via loop order)

            // Update Global Fields (most constrained)
            if (lateFinish.getTime() < task.lateFinish!.getTime()) {
                task.lateFinish = lateFinish;
            }

            // Calculate LS for this pass to check criticality
            const durationForCalc = task.duration > 0 ? task.duration - 1 : 0;
            const taskCalendar = taskCalendarMap.get(taskId) || calendar;
            let lateStart: Date;

            if (lateFinish.getTime() === MAX_DATE.getTime()) {
                lateStart = MAX_DATE;
            } else {
                lateStart = calendarService.addWorkingDays(lateFinish, -durationForCalc, taskCalendar);
                if (task.constraintType === 'Must Start On' && task.constraintDate) {
                    lateStart = new Date(Math.min(lateStart.getTime(), startOfDay(task.constraintDate).getTime()));
                }
            }

            if (lateStart.getTime() < task.lateStart!.getTime()) {
                task.lateStart = lateStart;
            }

            // Check Criticality for THIS project
            if (task.start && lateStart.getTime() !== MAX_DATE.getTime()) {
                let totalFloat = calendarService.getWorkingDaysDuration(task.start, lateStart, taskCalendar);
                if (totalFloat > 0) totalFloat -= 1;

                if (totalFloat <= 0) {
                    if (!task.criticalFor) task.criticalFor = [];
                    task.criticalFor.push(targetPid);
                }
            }
        }
    }

    // Final clean up of global fields
    for (const taskId of sortedTasks) {
        const task = taskMap.get(taskId)!;
        if (task.isSummary) continue;

        const taskCalendar = taskCalendarMap.get(taskId) || calendar;

        if (task.lateFinish?.getTime() === MAX_DATE.getTime()) {
             // Not constrained by anything (shouldn't happen if connected to end, but possible for isolated tasks)
             // Set to project max finish?
             const maxFinish = new Date(Math.max(...Object.values(projectFinishDates).map(d => d.getTime())));
             task.lateFinish = maxFinish;
             const durationForCalc = task.duration > 0 ? task.duration - 1 : 0;
             task.lateStart = calendarService.addWorkingDays(task.lateFinish, -durationForCalc, taskCalendar);
        }

        if (task.lateStart && task.start) {
            task.totalFloat = calendarService.getWorkingDaysDuration(task.start, task.lateStart, taskCalendar);
             if (task.totalFloat > 0) task.totalFloat -= 1;
        } else {
            task.totalFloat = 0;
        }
        task.isCritical = (task.criticalFor && task.criticalFor.length > 0);
    }

    // Update driving status on links
    for(const link of expandedLinks) {
        const originalLink = links.find(l => link.id.startsWith(l.id));
        if (!originalLink) continue;
        
        originalLink.isDriving = false;
        const targetTask = taskMap.get(link.target);
        const sourceTask = taskMap.get(link.source);
        if (!targetTask || !sourceTask) continue;
        
        const targetCalendar = taskCalendarMap.get(link.target) || calendar;

        let potentialStart: Date;
        switch (link.type) {
            case 'FS':
                potentialStart = calendarService.addWorkingDays(sourceTask.finish, link.lag + 1, targetCalendar);
                break;
            case 'SS':
                potentialStart = calendarService.addWorkingDays(sourceTask.start, link.lag, targetCalendar);
                break;
            case 'FF':
                 const tempFinishFF = calendarService.addWorkingDays(sourceTask.finish, link.lag, targetCalendar);
                 const durationValue = targetTask.duration > 0 ? targetTask.duration - 1 : 0;
                 potentialStart = calendarService.addWorkingDays(tempFinishFF, -durationValue, targetCalendar);
                break;
            case 'SF':
                 const tempFinishSF = calendarService.addWorkingDays(sourceTask.start, link.lag, targetCalendar);
                 const sfDurationValue = targetTask.duration > 0 ? targetTask.duration - 1 : 0;
                 potentialStart = calendarService.addWorkingDays(tempFinishSF, -sfDurationValue, targetCalendar);
                break;
            default:
                potentialStart = new Date(0);
        }
        potentialStart = calendarService.isWorkingDay(potentialStart, targetCalendar) ? potentialStart : calendarService.findNextWorkingDay(potentialStart, targetCalendar);
        
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
