import type { Link, Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function SuccessorList({ successorLinks, allTasks }: { successorLinks: Link[], allTasks: Task[] }) {
    if (successorLinks.length === 0) {
        return <p className="text-sm text-muted-foreground p-4 text-center">This task has no successors.</p>;
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
                    {successorLinks.map(link => {
                        const targetTask = taskMap.get(link.target);
                        return (
                            <TableRow key={link.id}>
                                <TableCell className="font-medium">{targetTask?.name || 'Unknown Task'}</TableCell>
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
