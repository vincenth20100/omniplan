'use client';
import type { ProjectState, Task } from '@/lib/types';
import { KanbanColumn } from './kanban-column';

const KANBAN_COLUMNS = ['To Do', 'In Progress', 'Done'];

export function KanbanView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { tasks } = projectState;

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

    return (
        <div className="flex gap-4 h-full overflow-x-auto p-4">
            {KANBAN_COLUMNS.map(status => (
                <KanbanColumn
                    key={status}
                    status={status}
                    tasks={tasksByStatus[status] || []}
                    onDrop={handleDrop}
                    projectState={projectState}
                    dispatch={dispatch}
                />
            ))}
        </div>
    );
}
