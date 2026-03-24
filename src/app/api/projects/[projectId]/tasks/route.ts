import { NextRequest } from 'next/server';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireProjectAccess, authErrorResponse } from '@/lib/auth-middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId } = await params;
    await requireProjectAccess(user.id, projectId);

    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    return Response.json(rows);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId } = await params;
    await requireProjectAccess(user.id, projectId, 'editor');

    const body = await req.json();
    const {
      name,
      parentId,
      startDate,
      finishDate,
      duration,
      durationUnit,
      work,
      schedulingType,
      constraintType,
      constraintDate,
      deadline,
      percentComplete,
      status,
      isMilestone,
      isSummary,
      isCollapsed,
      wbs,
      outlineLevel,
      calendarId,
      notes,
      customFields,
      order,
    } = body as typeof tasks.$inferInsert;

    const [task] = await db
      .insert(tasks)
      .values({
        projectId,
        name,
        parentId,
        startDate,
        finishDate,
        duration,
        durationUnit,
        work,
        schedulingType,
        constraintType,
        constraintDate,
        deadline,
        percentComplete,
        status,
        isMilestone,
        isSummary,
        isCollapsed,
        wbs,
        outlineLevel,
        calendarId,
        notes,
        customFields: customFields ?? {},
        order,
      })
      .returning();

    return Response.json(task, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
