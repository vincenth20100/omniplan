'use client';
import { Task, UiDensity } from '@/lib/types';
import { NotesSection } from './notes-section';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { AppUser as User } from '@/types/auth';

interface TaskActivityLogPanelProps {
    task: Task;
    dispatch: any;
    uiDensity: UiDensity;
    user: User;
}

export function TaskActivityLogPanel({ task, dispatch, uiDensity, user }: TaskActivityLogPanelProps) {
    const isMobile = useIsMobile();

    return (
        <div className={cn(
            "h-full",
            (uiDensity === 'large' && !isMobile) && 'p-4',
            (uiDensity === 'medium' && !isMobile) && 'p-3',
            (uiDensity === 'compact' || isMobile) && 'p-2'
        )}>
            <NotesSection task={task} dispatch={dispatch} user={user} />
        </div>
    );
}
