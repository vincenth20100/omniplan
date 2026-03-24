/**
 * Prepends the Next.js basePath so fetch() calls work correctly
 * whether the app is served at / or /omniplan.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function apiPath(path: string): string {
  return `${BASE}${path}`;
}
