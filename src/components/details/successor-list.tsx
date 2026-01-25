import type { Link, Task, UiDensity } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableCell } from '@/components/omni-gantt/editable-cell';
import { cn } from '@/lib/utils';

export function SuccessorList({ successorLinks, allTasks, dispatch, uiDensity }: { successorLinks: Link[], allTasks: Task[], dispatch: any, uiDensity: UiDensity }) {
    if (successorLinks.length === 0) {
        return <div className="border rounded-md min-h-[120px] flex items-center justify-center"><p className="text-sm text-muted-foreground">This task has no successors.</p></div>;
    }

    const taskMap = new Map(allTasks.map(t => [t.id, t]));

    const cellInnerDivClass = cn(
        "flex items-center h-full",
        uiDensity === 'large' && "px-4 text-sm",
        uiDensity === 'medium' && "px-3 text-sm",
        uiDensity === 'compact' && "px-2 text-xs"
    );

    const cellClass = cn(
        "p-0 font-medium truncate",
        uiDensity === 'large' && "h-12",
        uiDensity === 'medium' && "h-10",
        uiDensity === 'compact' && "h-8"
    );

    return (
        <ScrollArea className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow 
                        data-density={uiDensity}
                        className={cn(
                            "data-[density=large]:h-12",
                            "data-[density=medium]:h-10",
                            "data-[density=compact]:h-8"
                        )}
                    >
                        <TableHead className="w-[40px] p-0"><div className={cellInnerDivClass}>ID</div></TableHead>
                        <TableHead className="p-0"><div className={cellInnerDivClass}>Task</div></TableHead>
                        <TableHead className="w-[50px] p-0"><div className={cellInnerDivClass}>Type</div></TableHead>
                        <TableHead className="w-[60px] p-0"><div className={cellInnerDivClass}>Lag</div></TableHead>
                        <TableHead className="w-[90px] p-0"><div className={cellInnerDivClass}>Start</div></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {successorLinks.map(link => {
                        const targetTask = taskMap.get(link.target);
                        return (
                            <TableRow 
                                key={link.id}
                                data-density={uiDensity}
                                className={cn(
                                    "data-[density=large]:h-12",
                                    "data-[density=medium]:h-10",
                                    "data-[density=compact]:h-8"
                                )}
                            >
                                <TableCell className={cellClass}>
                                    <div className={cellInnerDivClass}>{targetTask?.wbs || 'N/A'}</div>
                                </TableCell>
                                <TableCell className={cn(cellClass, "max-w-[20ch]")} title={targetTask?.name}>
                                    <div className={cellInnerDivClass}>{targetTask?.name || 'Unknown Task'}</div>
                                </TableCell>
                                <TableCell className={cellClass}>
                                    <div className={cellInnerDivClass}><Badge variant="secondary">{link.type}</Badge></div>
                                </TableCell>
                                 <TableCell className={cellClass}>
                                    <div className={cellInnerDivClass}>
                                        <EditableCell
                                            value={`${link.lag || 0}`}
                                            onSave={(newValue) => {
                                                const newLag = parseInt(newValue, 10);
                                                if (!isNaN(newLag)) {
                                                    dispatch({ type: 'UPDATE_LINK', payload: { id: link.id, lag: newLag } });
                                                }
                                            }}
                                            className="text-right w-full"
                                        />
                                    </div>
                                </TableCell>
                                <TableCell className={cellClass}>
                                    <div className={cellInnerDivClass}>{targetTask ? format(targetTask.start, 'MMM d, yy') : 'N/A'}</div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
