import PocketBase from 'pocketbase';
import { NextRequest } from 'next/server';
import type { AppUser } from '@/types/auth';
import { db } from '@/db';
import { projectMembers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function authErrorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error('Unhandled API error:', err);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}

export async function requireAuth(req: NextRequest | Request): Promise<AppUser> {
  if (process.env.AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return { id: 'dev-user', email: 'dev@local', name: 'Dev User', token: 'dev', avatarUrl: null };
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing authorization header', 401);
  }

  const token = authHeader.slice(7);
  const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://localhost:8090');
  pb.authStore.save(token, null);

  try {
    const authData = await pb.collection('users').authRefresh();
    return {
      id: authData.record.id,
      email: authData.record.email ?? '',
      name: authData.record.name ?? '',
      token: pb.authStore.token,
      avatarUrl: authData.record.avatarUrl ?? null,
    };
  } catch {
    throw new AuthError('Invalid or expired token', 401);
  }
}

export async function requireProjectAccess(
  userId: string,
  projectId: string,
  minRole: 'viewer' | 'editor' | 'owner' = 'viewer'
): Promise<void> {
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ));
  if (!member) throw new AuthError('Project not found or access denied', 404);
  const roleRank: Record<string, number> = { viewer: 0, editor: 1, owner: 2 };
  if (roleRank[member.role] < roleRank[minRole]) {
    throw new AuthError('Insufficient permissions', 403);
  }
}
