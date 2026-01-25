import type { Link, Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

export function PredecessorList({ predecessorLinks, allTasks }: { predecessorLinks: Link[], allTasks: Task[] }) {
    if (predecessorLinks.length === 0) {
        return <div className="border rounded-md h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">This task has no predecessors.</p></div>;
    }

    const taskMap = new Map(allTasks.map(t => [t.id, t]));

    return (
        <ScrollArea className="border rounded-md h-full">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">ID</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead className="w-[60px]">Type</TableHead>
                        <TableHead className="w-[90px]">Finish Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {predecessorLinks.map(link => {
                        const sourceTask = taskMap.get(link.source);
                        return (
                            <TableRow key={link.id} className={cn(link.isDriving && "bg-destructive/10")}>
                                <TableCell>{sourceTask?.wbs || 'N/A'}</TableCell>
                                <TableCell className="font-medium truncate" title={sourceTask?.name}>{sourceTask?.name || 'Unknown Task'}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{link.type}</Badge>
                                </TableCell>
                                <TableCell>{sourceTask ? format(sourceTask.finish, 'MMM d, yy') : 'N/A'}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
