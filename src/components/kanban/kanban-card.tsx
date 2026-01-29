'use client';
import type { Task, ProjectState } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function KanbanCard({ task, projectState, dispatch, dateFormat }: { task: Task, projectState: ProjectState, dispatch: any, dateFormat: string }) {

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('text/plain', task.id);
    };

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        dispatch({ type: 'UPDATE_SELECTION', payload: { mode: 'row', taskId: task.id, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey } });
    }

    const isSelected = projectState.selectedTaskIds.includes(task.id);
    const resourceNames = projectState.assignments
        .filter(a => a.taskId === task.id)
        .map(a => projectState.resources.find(r => r.id === a.resourceId)?.name)
        .filter(Boolean)
        .join(', ');

    return (
        <Card 
            draggable 
            onDragStart={handleDragStart} 
            onClick={handleCardClick}
            className={`cursor-grab ${isSelected ? 'ring-2 ring-primary' : ''}`}
        >
            <CardHeader className="p-4">
                <CardTitle className="text-base">{task.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm space-y-2">
                <p className="text-muted-foreground">
                    {format(task.start, dateFormat)} - {format(task.finish, dateFormat)} ({task.duration}d)
                </p>
                {resourceNames && (
                    <p className="text-muted-foreground text-xs">
                        {resourceNames}
                    </p>
                )}
                <div className="flex gap-2">
                    <Badge variant="outline">WBS: {task.wbs}</Badge>
                    <Badge variant="secondary">{task.percentComplete}%</Badge>
                </div>
            </CardContent>
        </Card>
    );
}
