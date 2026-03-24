import { NextRequest } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
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

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    return Response.json(project);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId } = await params;
    await requireProjectAccess(user.id, projectId, 'editor');

    const body = await req.json();
    const { name, description, status, settings } = body as {
      name?: string;
      description?: string;
      status?: 'active' | 'archived' | 'template';
      settings?: Record<string, unknown>;
    };

    const updateData: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (settings !== undefined) updateData.settings = settings;

    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning();

    if (!updated) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    return Response.json(updated);
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
    await requireProjectAccess(user.id, projectId, 'owner');

    await db.delete(projects).where(eq(projects.id, projectId));

    return new Response(null, { status: 204 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
