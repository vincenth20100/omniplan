import { NextRequest } from 'next/server';
import { db } from '@/db';
import { links } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireAuth, requireProjectAccess, authErrorResponse } from '@/lib/auth-middleware';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; linkId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { projectId, linkId } = await params;
    await requireProjectAccess(user.id, projectId, 'editor');

    await db
      .delete(links)
      .where(and(eq(links.id, linkId), eq(links.projectId, projectId)));

    return new Response(null, { status: 204 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
