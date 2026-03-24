import { NextRequest } from 'next/server';
import postgres from 'postgres';
import { requireAuth, requireProjectAccess, authErrorResponse } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const token = req.nextUrl.searchParams.get('token') ?? '';

  // Validate auth — SSE can't set headers, token comes via query param
  const fakeReq = new Request(req.url, {
    headers: { authorization: `Bearer ${token}` },
  });

  try {
    const user = await requireAuth(fakeReq as any);
    await requireProjectAccess(user.id, projectId);
  } catch (err) {
    return authErrorResponse(err);
  }

  const channel = `omniplan_project_${projectId}`;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const encoder = new TextEncoder();
  let heartbeatInterval: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      await sql.listen(channel, (payload) => {
        try {
          send(JSON.parse(payload));
        } catch {
          send({ raw: payload });
        }
      });

      req.signal.addEventListener('abort', async () => {
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch {}
        await sql.end().catch(() => {});
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
