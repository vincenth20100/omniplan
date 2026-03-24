import { NextRequest } from 'next/server';
import { db } from '@/db';
import { tasks, links, resources, assignments } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireAuth, requireProjectAccess, authErrorResponse } from '@/lib/auth-middleware';
import { calculateSchedule } from '@/lib/scheduler';
import type { Task, Link, Resource, Assignment, Calendar } from '@/lib/types';

// Default project calendar: Mon–Fri working week
const DEFAULT_CALENDAR: Calendar = {
  id: 'default',
  name: 'Standard',
  workingDays: [1, 2, 3, 4, 5],
};

function dbTaskToLibTask(t: typeof tasks.$inferSelect): Task {
  return {
    id: t.id,
    name: t.name,
    start: t.startDate ?? new Date(),
    finish: t.finishDate ?? new Date(),
    duration: t.duration ?? 1,
    durationUnit: (t.durationUnit as Task['durationUnit']) ?? 'd',
    percentComplete: t.percentComplete ?? 0,
    status: t.status ?? '',
    parentId: t.parentId,
    isSummary: t.isSummary ?? false,
    isCollapsed: t.isCollapsed ?? false,
    wbs: t.wbs ?? undefined,
    level: t.outlineLevel ?? 0,
    constraintType: (t.constraintType as Task['constraintType']) ?? null,
    constraintDate: t.constraintDate ?? null,
    deadline: t.deadline ?? null,
    work: t.work ?? undefined,
    schedulingType: (t.schedulingType as Task['schedulingType']) ?? 'duration',
    totalFloat: t.totalFloat ?? undefined,
    freeFloat: t.freeFloat ?? undefined,
    isCritical: t.isOnCriticalPath ?? false,
    calendarId: t.calendarId ?? null,
    projectId: t.projectId,
  };
}

function dbLinkToLibLink(l: typeof links.$inferSelect): Link {
  return {
    id: l.id,
    source: l.sourceTaskId,
    target: l.targetTaskId,
    type: l.linkType as Link['type'],
    lag: l.lag ?? 0,
    sourceProjectId: l.sourceProjectId ?? undefined,
    targetProjectId: l.targetProjectId ?? undefined,
  };
}

function dbResourceToLibResource(r: typeof resources.$inferSelect): Resource {
  return {
    id: r.id,
    name: r.name,
    initials: r.initials ?? undefined,
    type: r.type as Resource['type'],
    category: r.category ?? undefined,
    costPerHour: r.costPerHour ?? undefined,
    availability: r.availability ?? undefined,
    calendarId: r.calendarId ?? null,
    order: r.order ?? undefined,
  };
}

function dbAssignmentToLibAssignment(a: typeof assignments.$inferSelect): Assignment {
  return {
    id: a.id,
    taskId: a.taskId,
    resourceId: a.resourceId,
    units: a.units ?? undefined,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId } = await params;
    await requireProjectAccess(user.id, projectId, 'editor');

    // Fetch all project data
    const dbTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const dbLinks = await db
      .select()
      .from(links)
      .where(eq(links.projectId, projectId));

    const dbResources = await db
      .select()
      .from(resources)
      .where(eq(resources.projectId, projectId));

    const taskIds = dbTasks.map((t) => t.id);
    const dbAssignments =
      taskIds.length > 0
        ? await db
            .select()
            .from(assignments)
            .where(inArray(assignments.taskId, taskIds))
        : [];

    // Convert to lib types
    const libTasks = dbTasks.map(dbTaskToLibTask);
    const libLinks = dbLinks.map(dbLinkToLibLink);
    const libResources = dbResources.map(dbResourceToLibResource);
    const libAssignments = dbAssignments.map(dbAssignmentToLibAssignment);

    // Run scheduler
    const scheduled = calculateSchedule(
      libTasks,
      libLinks,
      undefined,
      DEFAULT_CALENDAR,
      libAssignments,
      libResources,
    );

    // Batch-update tasks with computed schedule fields
    let updated = 0;
    for (const t of scheduled) {
      await db
        .update(tasks)
        .set({
          startDate: t.start,
          finishDate: t.finish,
          totalFloat: t.totalFloat ?? null,
          isOnCriticalPath: t.isCritical ?? false,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, t.id), eq(tasks.projectId, projectId)));
      updated++;
    }

    return Response.json({ updated });
  } catch (err) {
    return authErrorResponse(err);
  }
}
