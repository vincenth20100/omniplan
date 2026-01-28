'use client';
import type { Task, ProjectState } from '@/lib/types';
import { KanbanCard } from './kanban-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function KanbanColumn({ status, tasks, onDrop, projectState, dispatch }: { status: string, tasks: Task[], onDrop: (taskId: string, newStatus: string) => void, projectState: ProjectState, dispatch: any }) {
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        onDrop(taskId, status);
    };

    return (
        <div 
            className="w-80 h-full bg-muted/50 rounded-lg flex flex-col flex-shrink-0"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <h3 className="p-4 text-lg font-semibold border-b">{status} ({tasks.length})</h3>
            <ScrollArea className="flex-grow p-4">
                <div className="flex flex-col gap-4">
                    {tasks.map(task => (
                        <KanbanCard 
                            key={task.id} 
                            task={task} 
                            projectState={projectState}
                            dispatch={dispatch}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
