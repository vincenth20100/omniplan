import { NextRequest } from 'next/server';
import { db } from '@/db';
import { assignments, tasks } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireAuth, requireProjectAccess, authErrorResponse } from '@/lib/auth-middleware';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId } = await params;
    await requireProjectAccess(user.id, projectId);

    // Join assignments with tasks to filter by projectId
    const projectTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const taskIds = projectTasks.map((t) => t.id);

    if (taskIds.length === 0) {
      return Response.json([]);
    }

    const rows = await db
      .select()
      .from(assignments)
      .where(inArray(assignments.taskId, taskIds));

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

    const body = await req.json() as {
      taskId: string;
      resourceId: string;
      units?: number;
      work?: number;
    };

    const [assignment] = await db
      .insert(assignments)
      .values({
        taskId: body.taskId,
        resourceId: body.resourceId,
        units: body.units,
        work: body.work,
      })
      .returning();

    return Response.json(assignment, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId } = await params;
    await requireProjectAccess(user.id, projectId, 'editor');

    const body = await req.json() as { id: string };

    if (!body.id) {
      return Response.json({ error: 'Assignment id is required' }, { status: 400 });
    }

    await db
      .delete(assignments)
      .where(eq(assignments.id, body.id));

    return new Response(null, { status: 204 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
