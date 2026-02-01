'use client';
import type { Task, Link, UiDensity, Calendar, ProjectState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PredecessorList } from './predecessor-list';
import { SuccessorList } from './successor-list';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesSection } from './notes-section';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { InfoSection } from './info-section';
import { ResourceSection } from './resource-section';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';

export function TaskDetailsPanel({ task, projectState, dispatch, onClose, uiDensity, defaultCalendar, dateFormat, layoutMode = 'responsive' }: { task: Task, projectState: ProjectState, dispatch: any, onClose: () => void, uiDensity: UiDensity, defaultCalendar: Calendar | null, dateFormat: string, layoutMode?: 'responsive' | 'vertical' }) {
    const isMobile = useIsMobile();
    const { links, tasks, resources, assignments } = projectState;
    const predecessors = links.filter(l => l.target === task.id);
    const successors = links.filter(l => l.source === task.id);
    const taskAssignments = assignments.filter(a => a.taskId === task.id);

    return (
        <div className="flex flex-col h-full bg-card border-t rounded-t-lg overflow-hidden">
            <div className={cn(
                    "flex items-center justify-between border-b shrink-0",
                    (uiDensity === 'large' && !isMobile) && 'p-4',
                    (uiDensity === 'medium' && !isMobile) && 'p-3',
                    (uiDensity === 'compact' || isMobile) && 'p-2'
                )}>
                <div>
                    <h2 className={cn(
                        "font-semibold",
                        (uiDensity === 'large' && !isMobile) && 'text-lg',
                        (uiDensity === 'medium' && !isMobile) && 'text-base',
                        (uiDensity === 'compact' || isMobile) && 'text-base'
                    )}>{task.name}</h2>
                    <p className={cn(
                        "text-muted-foreground",
                         (uiDensity === 'large' && !isMobile) && 'text-sm',
                         (uiDensity === 'medium' && !isMobile) && 'text-xs',
                         (uiDensity === 'compact' || isMobile) && 'text-xs'
                    )}>
                        {format(new Date(task.start), dateFormat)} - {format(new Date(task.finish), dateFormat)} ({task.duration} working days)
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>
             <Tabs defaultValue="links" className="flex-grow flex flex-col overflow-hidden">
                <div className={cn(
                    "shrink-0 border-b",
                    (uiDensity === 'large' && !isMobile) && 'px-4',
                    (uiDensity === 'medium' && !isMobile) && 'px-3',
                    (uiDensity === 'compact' || isMobile) && 'px-2'
                )}>
                    <TabsList className="bg-transparent p-0">
                        <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Links</TabsTrigger>
                        <TabsTrigger value="resources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Resources</TabsTrigger>
                        <TabsTrigger value="dates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Dates</TabsTrigger>
                        <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Activity Log</TabsTrigger>
                    </TabsList>
                </div>
                
                <div className="flex-grow overflow-auto">
                    <TabsContent value="links" className="m-0 h-full">
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
                    </TabsContent>
                    <TabsContent value="resources" className="m-0 h-full">
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
                                dispatch={dispatch}
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="dates" className="m-0 h-full">
                         <div className={cn(
                            "h-full",
                            (uiDensity === 'large' && !isMobile) && 'p-4',
                            (uiDensity === 'medium' && !isMobile) && 'p-3',
                            (uiDensity === 'compact' || isMobile) && 'p-2'
                        )}>
                            <InfoSection task={task} dispatch={dispatch} defaultCalendar={defaultCalendar} dateFormat={dateFormat} />
                        </div>
                    </TabsContent>
                    <TabsContent value="notes" className="m-0 h-full">
                         <div className={cn(
                            "h-full",
                            (uiDensity === 'large' && !isMobile) && 'p-4',
                            (uiDensity === 'medium' && !isMobile) && 'p-3',
                            (uiDensity === 'compact' || isMobile) && 'p-2'
                        )}>
                            <NotesSection task={task} dispatch={dispatch} />
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
