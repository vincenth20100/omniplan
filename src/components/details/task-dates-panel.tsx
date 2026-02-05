'use client';
import { Task, UiDensity, Calendar } from '@/lib/types';
import { InfoSection } from './info-section';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface TaskDatesPanelProps {
    task: Task;
    dispatch: any;
    uiDensity: UiDensity;
    defaultCalendar: Calendar | null;
    dateFormat: string;
}

export function TaskDatesPanel({ task, dispatch, uiDensity, defaultCalendar, dateFormat }: TaskDatesPanelProps) {
    const isMobile = useIsMobile();

    return (
        <div className={cn(
            "h-full",
            (uiDensity === 'large' && !isMobile) && 'p-4',
            (uiDensity === 'medium' && !isMobile) && 'p-3',
            (uiDensity === 'compact' || isMobile) && 'p-2'
        )}>
            <InfoSection task={task} dispatch={dispatch} defaultCalendar={defaultCalendar} dateFormat={dateFormat} />
        </div>
    );
}
