'use client';
import type { Task, Link, UiDensity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PredecessorList } from './predecessor-list';
import { SuccessorList } from './successor-list';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TaskDetailsPanel({ task, links, tasks, dispatch, onClose, uiDensity }: { task: Task, links: Link[], tasks: Task[], dispatch: any, onClose: () => void, uiDensity: UiDensity }) {

    const predecessors = links.filter(l => l.target === task.id);
    const successors = links.filter(l => l.source === task.id);

    return (
        <div className="flex flex-col h-full bg-card border-t rounded-t-lg overflow-hidden">
            <div className={cn(
                    "flex items-center justify-between border-b",
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
                        {format(task.start, 'EEE, MMM d, yyyy')} - {format(task.finish, 'EEE, MMM d, yyyy')} ({task.duration} working days)
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>
            <div className={cn(
                "flex-grow overflow-auto grid grid-cols-1 lg:grid-cols-2 gap-4",
                 uiDensity === 'large' && 'p-4',
                 uiDensity === 'medium' && 'p-3',
                 uiDensity === 'compact' && 'p-2'
            )}>
                 <div className="flex flex-col gap-2 min-w-0">
                    <h3 className="text-md font-semibold">Predecessors</h3>
                    <PredecessorList currentTaskId={task.id} predecessorLinks={predecessors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} />
                </div>
                 <div className="flex flex-col gap-2 min-w-0">
                    <h3 className="text-md font-semibold">Successors</h3>
                    <SuccessorList currentTaskId={task.id} successorLinks={successors} allTasks={tasks} dispatch={dispatch} uiDensity={uiDensity} />
                </div>
            </div>
        </div>
    );
}
