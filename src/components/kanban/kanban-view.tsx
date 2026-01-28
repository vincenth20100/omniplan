'use client';
import type { ProjectState, Task } from '@/lib/types';
import { KanbanColumn } from './kanban-column';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { NotesSection } from '@/components/details/notes-section';

const KANBAN_COLUMNS = ['To Do', 'In Progress', 'Done'];

export function KanbanView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { tasks, selectedTaskIds } = projectState;

    const lastSelectedId = selectedTaskIds[selectedTaskIds.length - 1];
    const selectedTask = tasks.find(t => t.id === lastSelectedId);

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
                    <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-card border-l flex flex-col">
                        <div className="p-4 border-b shrink-0">
                            <h2 className="text-lg font-semibold">{selectedTask.name}</h2>
                             <p className="text-sm text-muted-foreground">{selectedTask.wbs}</p>
                        </div>
                         <div className="flex-grow p-4 overflow-hidden">
                            <NotesSection task={selectedTask} dispatch={dispatch} />
                        </div>
                    </ResizablePanel>
                </>
            )}
        </ResizablePanelGroup>
    );
}
