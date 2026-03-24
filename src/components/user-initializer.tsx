'use client';

import { useAuth } from '@/providers/auth-provider';
import { Loader2 } from 'lucide-react';

export function UserInitializer({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useAuth();

    // TODO(T5): implement user initialization via API

    if (user && isUserLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p className="text-muted-foreground">Setting up your workspace...</p>
            </div>
        );
    }

    return <>{children}</>;
}
