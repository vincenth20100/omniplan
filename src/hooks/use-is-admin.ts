'use client';

import type { AppUser } from '@/types/auth';

export function useIsAdmin(_user: AppUser | null | undefined) {
    // TODO(T5): implement via API
    return { isAdmin: false, isLoading: false };
}
