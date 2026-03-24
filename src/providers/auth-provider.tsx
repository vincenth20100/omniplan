'use client';

import { apiPath } from '@/lib/api-path';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  // Initialise auth state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pocketbase_auth');
      if (raw) {
        const { token, model } = JSON.parse(raw);
        if (token && model) {
          setUser({ id: model.id, email: model.email, name: model.name, avatarUrl: model.avatarUrl ?? null, token });
        }
      }
    } catch {}
    setIsUserLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUserError(null);
    const res = await fetch(apiPath('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      const error = new Error(err.error ?? 'Login failed');
      setUserError(error);
      throw error;
    }
    const { token, user: userData } = await res.json();
    // Store in localStorage in PocketBase SDK format so getAuthToken() in project-api.ts works
    localStorage.setItem('pocketbase_auth', JSON.stringify({ token, model: userData }));
    setUser({ ...userData, token });
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem('pocketbase_auth');
    setUser(null);
  }, []);

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
