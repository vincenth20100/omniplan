import PocketBase from 'pocketbase';

// ─── Client-side singleton ────────────────────────────────────────────────────
let _pb: PocketBase | null = null;

/**
 * Returns a PocketBase client singleton for client-side use.
 * Lazily created on first call; subsequent calls return the same instance.
 */
export function getPocketBase(): PocketBase {
  if (!_pb) {
    const url = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090';
    _pb = new PocketBase(url);
  }
  return _pb;
}

// ─── Server-side factory ──────────────────────────────────────────────────────

/**
 * Creates a fresh PocketBase instance for server-side use (Route Handlers,
 * Server Components, etc.). A new instance is created per request so that
 * auth state is never accidentally shared between requests.
 */
export function createServerPocketBase(): PocketBase {
  const url = process.env.POCKETBASE_URL ?? process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090';
  return new PocketBase(url);
}
