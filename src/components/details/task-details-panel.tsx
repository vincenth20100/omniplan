'use client';
import type { Task, Link } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PredecessorList } from './predecessor-list';

export function TaskDetailsPanel({ task, links, tasks, onClose }: { task: Task, links: Link[], tasks: Task[], onClose: () => void }) {

    const predecessors = links.filter(l => l.target === task.id);

    return (
        <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="h-[40vh]">
                <SheetHeader>
                    <SheetTitle>{task.name}</SheetTitle>
                    <SheetDescription>
                        {format(task.start, 'EEE, MMM d, yyyy')} - {format(task.finish, 'EEE, MMM d, yyyy')} ({task.duration} working days)
                    </SheetDescription>
                </SheetHeader>
                <div className="py-4 grid gap-4">
                    <div>
                        <h4 className="font-semibold mb-2">Predecessors</h4>
                        <PredecessorList predecessorLinks={predecessors} allTasks={tasks} />
                    </div>
                </div>
                 <SheetFooter>
                    <Button onClick={onClose} variant="outline">Close</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
