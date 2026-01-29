'use client';
import type { ProjectState, Task } from '@/lib/types';
import { KanbanColumn } from './kanban-column';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TaskDetailsPanel } from '@/components/details/task-details-panel';
import { useMemo } from 'react';

const KANBAN_COLUMNS = ['To Do', 'In Progress', 'Done'];

export function KanbanView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { tasks, links, selectedTaskIds, ganttSettings, uiDensity, calendars, defaultCalendarId } = projectState;
    const dateFormat = ganttSettings.dateFormat || 'MMM d, yyyy';

    const lastSelectedId = selectedTaskIds[selectedTaskIds.length - 1];
    const selectedTask = tasks.find(t => t.id === lastSelectedId);

    const defaultCalendar = useMemo(() => calendars.find(c => c.id === defaultCalendarId) || calendars[0] || null, [calendars, defaultCalendarId]);

    const tasksByStatus = tasks.reduce((acc, task) => {
        if (task.isSummary) return acc;
        const status = task.status || 'To Do';
        if (!acc[status]) {
            acc[status] = [];
        }
        acc[status].push(task);
        return acc;
    }, {} as Record<string, Task[]>);

    const handleDrop = (taskId: string, newStatus: string) => {
        dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, status: newStatus } });
    };

    const KanbanBoardContent = (
        <div className="flex gap-4 h-full overflow-x-auto p-4">
            {KANBAN_COLUMNS.map(status => (
                <KanbanColumn
                    key={status}
                    status={status}
                    tasks={tasksByStatus[status] || []}
                    onDrop={handleDrop}
                    projectState={projectState}
                    dispatch={dispatch}
                    dateFormat={dateFormat}
                />
            ))}
        </div>
    );

    return (
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel>
                {KanbanBoardContent}
            </ResizablePanel>
            {selectedTask && (
                <>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={35} minSize={20}>
                      <TaskDetailsPanel 
                        task={selectedTask} 
                        links={links} 
                        tasks={tasks}
                        dispatch={dispatch}
                        onClose={() => dispatch({ type: 'UPDATE_SELECTION', payload: { mode: 'row', taskId: null } })}
                        uiDensity={uiDensity}
                        defaultCalendar={defaultCalendar}
                        dateFormat={dateFormat}
                      />
                    </ResizablePanel>
                </>
            )}
        </ResizablePanelGroup>
    );
}
