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

    return Response.json({ projectId, tasks: rows });
  } catch (err) {
    return authErrorResponse(err);
  }
}
