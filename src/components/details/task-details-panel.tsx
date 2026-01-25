'use client';
import type { Task, Link } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { PredecessorList } from './predecessor-list';
import { SuccessorList } from './successor-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function TaskDetailsPanel({ task, links, tasks, onClose }: { task: Task, links: Link[], tasks: Task[], onClose: () => void }) {

    const predecessors = links.filter(l => l.target === task.id);
    const successors = links.filter(l => l.source === task.id);

    return (
        <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="h-[50vh] flex flex-col">
                <SheetHeader>
                    <SheetTitle>{task.name}</SheetTitle>
                    <SheetDescription>
                        {format(task.start, 'EEE, MMM d, yyyy')} - {format(task.finish, 'EEE, MMM d, yyyy')} ({task.duration} working days)
                    </SheetDescription>
                </SheetHeader>
                <Tabs defaultValue="predecessors" className="flex-grow flex flex-col overflow-hidden mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="predecessors">Predecessors</TabsTrigger>
                        <TabsTrigger value="successors">Successors</TabsTrigger>
                    </TabsList>
                    <TabsContent value="predecessors" className="flex-grow overflow-auto mt-2">
                        <PredecessorList predecessorLinks={predecessors} allTasks={tasks} />
                    </TabsContent>
                    <TabsContent value="successors" className="flex-grow overflow-auto mt-2">
                        <SuccessorList successorLinks={successors} allTasks={tasks} />
                    </TabsContent>
                </Tabs>
                 <SheetFooter className="pt-4 mt-auto">
                    <Button onClick={onClose} variant="outline">Close</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
