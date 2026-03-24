import { NextRequest } from 'next/server';
import { requireAuth, requireProjectAccess, authErrorResponse } from '@/lib/auth-middleware';
import { identifySchedulingConflicts } from '@/ai/flows/identify-scheduling-conflicts';
import type { IdentifySchedulingConflictsInput } from '@/ai/flows/identify-scheduling-conflicts';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { projectId, tasks, links } = body;
    if (projectId) {
      await requireProjectAccess(user.id, projectId, 'viewer');
    }

    const formattedInput: IdentifySchedulingConflictsInput = {
      tasks: (tasks as IdentifySchedulingConflictsInput['tasks']).map((t) => ({
        id: t.id,
        name: t.name,
        start: new Date(t.start).toISOString(),
        finish: new Date(t.finish).toISOString(),
        constraintType: t.constraintType ?? null,
        constraintDate: t.constraintDate ? new Date(t.constraintDate).toISOString() : null,
        schedulingConflict: t.schedulingConflict ?? false,
      })),
      links: links as IdentifySchedulingConflictsInput['links'],
    };

    const result = await identifySchedulingConflicts(formattedInput);
    return Response.json({ success: true, data: result });
  } catch (err) {
    return authErrorResponse(err);
  }
}
