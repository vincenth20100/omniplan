'use client';
import { Task, ProjectState, UiDensity } from '@/lib/types';
import { ResourceSection } from './resource-section';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface TaskResourcesPanelProps {
    task: Task;
    projectState: ProjectState;
    dispatch: any;
    uiDensity: UiDensity;
}

export function TaskResourcesPanel({ task, projectState, dispatch, uiDensity }: TaskResourcesPanelProps) {
    const isMobile = useIsMobile();
    const { assignments, resources } = projectState;
    const taskAssignments = assignments.filter(a => a.taskId === task.id);

    return (
        <div className={cn(
            "h-full",
            (uiDensity === 'large' && !isMobile) && 'p-4',
            (uiDensity === 'medium' && !isMobile) && 'p-3',
            (uiDensity === 'compact' || isMobile) && 'p-2'
        )}>
            <ResourceSection
                task={task}
                assignments={taskAssignments}
                resources={resources}
                calendars={projectState.calendars}
                defaultCalendarId={projectState.defaultCalendarId}
                dispatch={dispatch}
            />
        </div>
    );
}
