'use client';
import type { Task, Link } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PredecessorList } from './predecessor-list';
import { SuccessorList } from './successor-list';
import { X } from 'lucide-react';

export function TaskDetailsPanel({ task, links, tasks, onClose }: { task: Task, links: Link[], tasks: Task[], onClose: () => void }) {

    const predecessors = links.filter(l => l.target === task.id);
    const successors = links.filter(l => l.source === task.id);

    return (
        <div className="flex flex-col h-full bg-card border-t rounded-t-lg overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b">
                <div>
                    <h2 className="text-lg font-semibold">{task.name}</h2>
                    <p className="text-sm text-muted-foreground">
                        {format(task.start, 'EEE, MMM d, yyyy')} - {format(task.finish, 'EEE, MMM d, yyyy')} ({task.duration} working days)
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>
            <div className="flex-grow overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="flex flex-col gap-2">
                    <h3 className="text-md font-semibold">Predecessors</h3>
                    <PredecessorList predecessorLinks={predecessors} allTasks={tasks} />
                </div>
                 <div className="flex flex-col gap-2">
                    <h3 className="text-md font-semibold">Successors</h3>
                    <SuccessorList successorLinks={successors} allTasks={tasks} />
                </div>
            </div>
        </div>
    );
}
