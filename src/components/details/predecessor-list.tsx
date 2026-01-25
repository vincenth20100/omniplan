import type { Link, Task } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableCell } from '@/components/omni-gantt/editable-cell';

export function PredecessorList({ predecessorLinks, allTasks, dispatch }: { predecessorLinks: Link[], allTasks: Task[], dispatch: any }) {
    if (predecessorLinks.length === 0) {
        return <div className="border rounded-md h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">This task has no predecessors.</p></div>;
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
                        <TableHead className="w-[90px]">Finish</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {predecessorLinks.map(link => {
                        const sourceTask = taskMap.get(link.source);
                        return (
                            <TableRow key={link.id} className={cn(link.isDriving && "bg-destructive/10")}>
                                <TableCell>{sourceTask?.wbs || 'N/A'}</TableCell>
                                <TableCell className="font-medium truncate max-w-[20ch]" title={sourceTask?.name}>{sourceTask?.name || 'Unknown Task'}</TableCell>
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
                                <TableCell>{sourceTask ? format(sourceTask.finish, 'MMM d, yy') : 'N/A'}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
