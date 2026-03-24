import { NextRequest } from 'next/server';
import { db } from '@/db';
import { links } from '@/db/schema';
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
      .from(links)
      .where(eq(links.projectId, projectId));

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
      sourceTaskId: string;
      targetTaskId: string;
      linkType?: 'FS' | 'SS' | 'FF' | 'SF';
      lag?: number;
      lagUnit?: string;
      sourceProjectId?: string;
      targetProjectId?: string;
    };

    const [link] = await db
      .insert(links)
      .values({
        projectId,
        sourceTaskId: body.sourceTaskId,
        targetTaskId: body.targetTaskId,
        linkType: body.linkType ?? 'FS',
        lag: body.lag ?? 0,
        lagUnit: body.lagUnit ?? 'days',
        sourceProjectId: body.sourceProjectId,
        targetProjectId: body.targetProjectId,
      })
      .returning();

    return Response.json(link, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
