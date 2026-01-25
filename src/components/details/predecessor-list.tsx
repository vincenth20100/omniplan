import type { Link, Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function PredecessorList({ predecessorLinks, allTasks }: { predecessorLinks: Link[], allTasks: Task[] }) {
    if (predecessorLinks.length === 0) {
        return <p className="text-sm text-muted-foreground">This task has no predecessors.</p>;
    }

    const taskMap = new Map(allTasks.map(t => [t.id, t]));

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Lag</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {predecessorLinks.map(link => {
                        const sourceTask = taskMap.get(link.source);
                        return (
                            <TableRow key={link.id} className={cn(link.isDriving && "bg-destructive/10")}>
                                <TableCell className="font-medium">{sourceTask?.name || 'Unknown Task'}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{link.type}</Badge>
                                </TableCell>
                                <TableCell>{link.lag} days</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
