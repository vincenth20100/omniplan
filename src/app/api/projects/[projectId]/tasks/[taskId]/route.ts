import { NextRequest } from 'next/server';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAuth, requireProjectAccess, authErrorResponse } from '@/lib/auth-middleware';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId, taskId } = await params;
    await requireProjectAccess(user.id, projectId, 'editor');

    const body = await req.json() as Partial<typeof tasks.$inferInsert>;

    const [updated] = await db
      .update(tasks)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
      .returning();

    if (!updated) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    return Response.json(updated);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId, taskId } = await params;
    await requireProjectAccess(user.id, projectId, 'editor');

    await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

    return new Response(null, { status: 204 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
