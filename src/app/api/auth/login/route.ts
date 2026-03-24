import { NextRequest } from 'next/server';
import PocketBase from 'pocketbase';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://localhost:8090');
    const authData = await pb.collection('users').authWithPassword(email, password);

    return Response.json({
      token: pb.authStore.token,
      user: {
        id: authData.record.id,
        email: authData.record.email ?? '',
        name: authData.record.name ?? authData.record.email ?? '',
        avatarUrl: authData.record.avatar ?? null,
      },
    });
  } catch (err: any) {
    const msg = err?.response?.message ?? err?.message ?? 'Login failed';
    return Response.json({ error: msg }, { status: 401 });
  }
}
