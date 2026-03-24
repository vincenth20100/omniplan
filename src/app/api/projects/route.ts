import { NextRequest } from 'next/server';
import { db } from '@/db';
import { projects, projectMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, authErrorResponse } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const rows = await db
      .select({
        id: projects.id,
        ownerId: projects.ownerId,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        settings: projects.settings,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        role: projectMembers.role,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, user.id));

    return Response.json(rows);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { name, description, settings } = body as {
      name: string;
      description?: string;
      settings?: Record<string, unknown>;
    };

    const [project] = await db
      .insert(projects)
      .values({
        ownerId: user.id,
        name,
        description,
        settings: settings ?? {},
      })
      .returning();

    await db.insert(projectMembers).values({
      projectId: project.id,
      userId: user.id,
      role: 'owner',
    });

    return Response.json(project, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
