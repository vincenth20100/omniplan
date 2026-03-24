'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getPocketBase } from '@/lib/pocketbase';
import type { AppUser } from '@/types/auth';

// ─── Context shape ────────────────────────────────────────────────────────────

export interface AuthContextState {
  /** The currently authenticated user, or null if not signed in */
  user: AppUser | null;
  /** True while the initial auth state is being determined */
  isUserLoading: boolean;
  /** Any error that occurred during auth state resolution */
  userError: Error | null;
  /** Sign in with email + password */
  login: (email: string, password: string) => Promise<void>;
  /** Sign out the current user */
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextState | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const pb = getPocketBase();

  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  // Convert PocketBase authStore model → AppUser
  const toAppUser = useCallback((): AppUser | null => {
    const model = pb.authStore.model;
    const token = pb.authStore.token;
    if (!model || !token) return null;

    const avatarRaw: string | undefined = model.avatar;
    let avatarUrl: string | null = null;
    if (avatarRaw) {
      // PocketBase file URL pattern: /api/files/<collection>/<id>/<filename>
      avatarUrl = `${pb.baseUrl}/api/files/${model.collectionId}/${model.id}/${avatarRaw}`;
    }

    return {
      id: model.id as string,
      email: (model.email as string) ?? '',
      name: (model.name as string) ?? (model.username as string) ?? '',
      avatarUrl,
      token,
    };
  }, [pb]);

  // Initialise auth state from existing token in localStorage (if any)
  useEffect(() => {
    try {
      if (pb.authStore.isValid) {
        setUser(toAppUser());
      } else {
        setUser(null);
      }
    } catch (err) {
      setUserError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsUserLoading(false);
    }

    // Subscribe to authStore changes for future sign-in / sign-out events
    const unsubscribe = pb.authStore.onChange(() => {
      try {
        if (pb.authStore.isValid) {
          setUser(toAppUser());
        } else {
          setUser(null);
        }
        setUserError(null);
      } catch (err) {
        setUserError(err instanceof Error ? err : new Error(String(err)));
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [pb, toAppUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setUserError(null);
      try {
        await pb.collection('users').authWithPassword(email, password);
        // authStore.onChange fires automatically; setUser handled there
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setUserError(error);
        throw error;
      }
    },
    [pb],
  );

  const logout = useCallback(async () => {
    pb.authStore.clear();
    // authStore.onChange fires automatically; setUser handled there
  }, [pb]);

  const value = useMemo<AuthContextState>(
    () => ({ user, isUserLoading, userError, login, logout }),
    [user, isUserLoading, userError, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Access the full auth context (user, loading, error, login, logout).
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Convenience hook — returns only the user auth state fields.
 * Mirrors the old Firebase `useUser()` hook signature so call-sites
 * can be updated with a simple import swap.
 */
export function useUser(): Pick<AuthContextState, 'user' | 'isUserLoading' | 'userError'> {
  const { user, isUserLoading, userError } = useAuth();
  return { user, isUserLoading, userError };
}
