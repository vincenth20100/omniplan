import type { Link, Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableCell } from '@/components/omni-gantt/editable-cell';

export function SuccessorList({ successorLinks, allTasks, dispatch }: { successorLinks: Link[], allTasks: Task[], dispatch: any }) {
    if (successorLinks.length === 0) {
        return <div className="border rounded-md h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">This task has no successors.</p></div>;
    }

    const taskMap = new Map(allTasks.map(t => [t.id, t]));

    return (
        <ScrollArea className="border rounded-md h-full">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[40px]">ID</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead className="w-[50px]">Type</TableHead>
                        <TableHead className="w-[60px]">Lag</TableHead>
                        <TableHead className="w-[90px]">Start</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {successorLinks.map(link => {
                        const targetTask = taskMap.get(link.target);
                        return (
                            <TableRow key={link.id}>
                                <TableCell>{targetTask?.wbs || 'N/A'}</TableCell>
                                <TableCell className="font-medium truncate" title={targetTask?.name}>{targetTask?.name || 'Unknown Task'}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{link.type}</Badge>
                                </TableCell>
                                 <TableCell>
                                    <EditableCell
                                        value={`${link.lag || 0}`}
                                        onSave={(newValue) => {
                                            const newLag = parseInt(newValue, 10);
                                            if (!isNaN(newLag)) {
                                                dispatch({ type: 'UPDATE_LINK', payload: { id: link.id, lag: newLag } });
                                            }
                                        }}
                                        className="text-right"
                                    />
                                </TableCell>
                                <TableCell>{targetTask ? format(targetTask.start, 'MMM d, yy') : 'N/A'}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
