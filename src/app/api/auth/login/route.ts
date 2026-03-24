import { NextRequest } from 'next/server';
import PocketBase from 'pocketbase';

// Local admin credentials — override via env vars
const LOCAL_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const LOCAL_PASSWORD = process.env.ADMIN_PASSWORD ?? 'psswd';
const LOCAL_TOKEN    = 'local|admin-static-token';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    // ── Local admin shortcut (no PocketBase required) ──────────────────────────
    if (email === LOCAL_USERNAME && password === LOCAL_PASSWORD) {
      return Response.json({
        token: LOCAL_TOKEN,
        user: { id: 'local-admin', email: LOCAL_USERNAME, name: 'Admin', avatarUrl: null },
      });
    }

    // ── PocketBase email/password ──────────────────────────────────────────────
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
