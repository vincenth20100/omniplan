'use client';
import { Task, ProjectState, UiDensity } from '@/lib/types';
import { PredecessorList } from './predecessor-list';
import { SuccessorList } from './successor-list';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface TaskLinksPanelProps {
    task: Task;
    projectState: ProjectState;
    dispatch: any;
    uiDensity: UiDensity;
    dateFormat: string;
    layoutMode?: 'responsive' | 'vertical';
}

export function TaskLinksPanel({ task, projectState, dispatch, uiDensity, dateFormat, layoutMode = 'responsive' }: TaskLinksPanelProps) {
    const isMobile = useIsMobile();
    const { links, tasks } = projectState;
    const predecessors = links.filter(l => l.target === task.id);
    const successors = links.filter(l => l.source === task.id);

    return (
        <div className={cn(
            (isMobile || layoutMode === 'vertical') ? "h-auto" : "h-full",
            (uiDensity === 'large' && !isMobile) && 'p-4',
            (uiDensity === 'medium' && !isMobile) && 'p-3',
            (uiDensity === 'compact' || isMobile) && 'p-2'
        )}>
           {(isMobile || layoutMode === 'vertical') ? (
             <div className="flex flex-col gap-6 pb-4">
                <div className="flex flex-col pr-1">
                    <h3 className="text-sm font-semibold mb-2 shrink-0">Predecessors</h3>
                    <PredecessorList currentTaskId={task.id} predecessorLinks={predecessors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} dateFormat={dateFormat} />
                </div>
                <Separator />
                <div className="flex flex-col pl-1">
                     <h3 className="text-sm font-semibold mb-2 shrink-0">Successors</h3>
                     <SuccessorList currentTaskId={task.id} successorLinks={successors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} dateFormat={dateFormat} />
                </div>
             </div>
           ) : (
               <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel>
                        <div className="h-full flex flex-col pr-1">
                            <h3 className="text-sm font-semibold mb-2 shrink-0">Predecessors</h3>
                            <PredecessorList currentTaskId={task.id} predecessorLinks={predecessors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} dateFormat={dateFormat} />
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel>
                        <div className="h-full flex flex-col pl-1">
                             <h3 className="text-sm font-semibold mb-2 shrink-0">Successors</h3>
                             <SuccessorList currentTaskId={task.id} successorLinks={successors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} dateFormat={dateFormat} />
                        </div>
                    </ResizablePanel>
               </ResizablePanelGroup>
           )}
        </div>
    );
}
