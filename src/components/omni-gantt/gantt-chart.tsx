'use client';
import type { ProjectState } from '@/lib/types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TaskTable } from './task-table';
import { Timeline } from './timeline';

export function GanttChart({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    return (
        <div className="border rounded-lg overflow-hidden h-full flex flex-col bg-card">
            <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={40} minSize={20}>
                    <TaskTable 
                        tasks={projectState.tasks} 
                        selectedTaskIds={projectState.selectedTaskIds} 
                        dispatch={dispatch} 
                        visibleColumns={projectState.visibleColumns}
                    />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={60}>
                    <Timeline 
                        tasks={projectState.tasks} 
                        links={projectState.links}
                        dispatch={dispatch}
                        selectedTaskIds={projectState.selectedTaskIds}
                        />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
