import { NextRequest } from 'next/server';
import { db } from '@/db';
import { resources } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
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
      .from(resources)
      .where(eq(resources.projectId, projectId));

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
      name: string;
      initials?: string;
      type?: 'Work' | 'Material' | 'Cost';
      category?: string;
      maxUnits?: number;
      costPerHour?: number;
      availability?: number;
      email?: string;
      calendarId?: string;
      order?: number;
    };

    const [resource] = await db
      .insert(resources)
      .values({
        projectId,
        name: body.name,
        initials: body.initials,
        type: body.type ?? 'Work',
        category: body.category,
        maxUnits: body.maxUnits,
        costPerHour: body.costPerHour,
        availability: body.availability,
        email: body.email,
        calendarId: body.calendarId,
        order: body.order,
      })
      .returning();

    return Response.json(resource, { status: 201 });
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

    const body = await req.json() as { id: string } & Partial<typeof resources.$inferInsert>;
    const { id, ...updateFields } = body;

    if (!id) {
      return Response.json({ error: 'Resource id is required' }, { status: 400 });
    }

    const [updated] = await db
      .update(resources)
      .set(updateFields)
      .where(and(eq(resources.id, id), eq(resources.projectId, projectId)))
      .returning();

    if (!updated) {
      return Response.json({ error: 'Resource not found' }, { status: 404 });
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
    await requireProjectAccess(user.id, projectId, 'editor');

    const body = await req.json() as { id: string };

    if (!body.id) {
      return Response.json({ error: 'Resource id is required' }, { status: 400 });
    }

    await db
      .delete(resources)
      .where(and(eq(resources.id, body.id), eq(resources.projectId, projectId)));

    return new Response(null, { status: 204 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
