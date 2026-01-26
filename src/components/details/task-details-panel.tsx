'use client';
import type { Task, Link, UiDensity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PredecessorList } from './predecessor-list';
import { SuccessorList } from './successor-list';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotesSection } from './notes-section';

export function TaskDetailsPanel({ task, links, tasks, dispatch, onClose, uiDensity }: { task: Task, links: Link[], tasks: Task[], dispatch: any, onClose: () => void, uiDensity: UiDensity }) {

    const predecessors = links.filter(l => l.target === task.id);
    const successors = links.filter(l => l.source === task.id);

    return (
        <div className="flex flex-col h-full bg-card border-t rounded-t-lg overflow-hidden">
            <div className={cn(
                    "flex items-center justify-between border-b shrink-0",
                    uiDensity === 'large' && 'p-4',
                    uiDensity === 'medium' && 'p-3',
                    uiDensity === 'compact' && 'p-2'
                )}>
                <div>
                    <h2 className={cn(
                        "font-semibold",
                        uiDensity === 'large' && 'text-lg',
                        uiDensity === 'medium' && 'text-base',
                        uiDensity === 'compact' && 'text-base'
                    )}>{task.name}</h2>
                    <p className={cn(
                        "text-muted-foreground",
                         uiDensity === 'large' && 'text-sm',
                         uiDensity === 'medium' && 'text-xs',
                         uiDensity === 'compact' && 'text-xs'
                    )}>
                        {format(new Date(task.start), 'EEE, MMM d, yyyy')} - {format(new Date(task.finish), 'EEE, MMM d, yyyy')} ({task.duration} working days)
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>
             <Tabs defaultValue="predecessors" className="flex-grow flex flex-col overflow-hidden">
                <div className={cn(
                    "shrink-0 border-b",
                    uiDensity === 'large' && 'px-4',
                    uiDensity === 'medium' && 'px-3',
                    uiDensity === 'compact' && 'px-2'
                )}>
                    <TabsList className="bg-transparent p-0">
                        <TabsTrigger value="predecessors" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Predecessors</TabsTrigger>
                        <TabsTrigger value="successors" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Successors</TabsTrigger>
                        <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Notes</TabsTrigger>
                    </TabsList>
                </div>
                
                <div className="flex-grow overflow-auto">
                    <TabsContent value="predecessors" className="m-0 h-full">
                        <div className={cn(
                            "h-full",
                            uiDensity === 'large' && 'p-4',
                            uiDensity === 'medium' && 'p-3',
                            uiDensity === 'compact' && 'p-2'
                        )}>
                           <PredecessorList currentTaskId={task.id} predecessorLinks={predecessors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} />
                        </div>
                    </TabsContent>
                    <TabsContent value="successors" className="m-0 h-full">
                         <div className={cn(
                            "h-full",
                            uiDensity === 'large' && 'p-4',
                            uiDensity === 'medium' && 'p-3',
                            uiDensity === 'compact' && 'p-2'
                        )}>
                            <SuccessorList currentTaskId={task.id} successorLinks={successors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} />
                        </div>
                    </TabsContent>
                    <TabsContent value="notes" className="m-0 h-full">
                         <div className={cn(
                            "h-full",
                            uiDensity === 'large' && 'p-4',
                            uiDensity === 'medium' && 'p-3',
                            uiDensity === 'compact' && 'p-2'
                        )}>
                            <NotesSection task={task} dispatch={dispatch} />
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
