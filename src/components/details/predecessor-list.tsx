'use client';
import type { Link, Task, UiDensity, LinkType } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableCell } from '@/components/omni-gantt/editable-cell';
import { EditableSelectCell } from '@/components/omni-gantt/editable-select-cell';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { AddRelationshipRow } from './add-relationship-row';

export function PredecessorList({ currentTaskId, predecessorLinks, allTasks, dispatch, uiDensity }: { currentTaskId: string, predecessorLinks: Link[], allTasks: Task[], dispatch: any, uiDensity: UiDensity }) {

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

    const linkTypeOptions = [
        { value: 'FS', label: 'FS' },
        { value: 'SS', label: 'SS' },
        { value: 'FF', label: 'FF' },
        { value: 'SF', label: 'SF' },
    ];

    return (
        <ScrollArea className="border rounded-md min-h-0">
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
                        <TableHead className="w-[80px] p-0"><div className={cellInnerDivClass}>Type</div></TableHead>
                        <TableHead className="w-[60px] p-0"><div className={cellInnerDivClass}>Lag</div></TableHead>
                        <TableHead className="w-[40px] p-0"><div className={cellInnerDivClass}></div></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {predecessorLinks.map(link => {
                        const sourceTask = taskMap.get(link.source);
                        if (!sourceTask) return null;
                        return (
                            <TableRow 
                                key={link.id} 
                                data-density={uiDensity}
                                className={cn(
                                    link.isDriving && "bg-destructive/10",
                                    "data-[density=large]:h-12",
                                    "data-[density=medium]:h-10",
                                    "data-[density=compact]:h-8"
                                )}
                            >
                                <TableCell className={cellClass}>
                                    <div className={cellInnerDivClass}>{sourceTask?.wbs || 'N/A'}</div>
                                </TableCell>
                                <TableCell className={cn(cellClass, "max-w-[15ch]")} title={sourceTask?.name}>
                                    <div className={cellInnerDivClass}>
                                        <EditableCell 
                                            value={sourceTask.name}
                                            onSave={(newValue) => {
                                                if(newValue.trim()){
                                                    dispatch({ type: 'UPDATE_TASK', payload: { id: sourceTask.id, name: newValue } });
                                                }
                                            }}
                                            className="w-full"
                                        />
                                    </div>
                                </TableCell>
                                <TableCell className={cellClass}>
                                    <div className={cellInnerDivClass}>
                                        <EditableSelectCell
                                            value={link.type}
                                            onSave={(newValue) => {
                                                if (newValue) {
                                                    dispatch({ type: 'UPDATE_LINK', payload: { id: link.id, type: newValue as LinkType } });
                                                }
                                            }}
                                            options={linkTypeOptions}
                                        />
                                    </div>
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
                                    <div className={cn(cellInnerDivClass, "justify-center")}>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dispatch({ type: 'REMOVE_LINK', payload: { linkId: link.id }})}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                     <AddRelationshipRow
                        currentTaskId={currentTaskId}
                        allTasks={allTasks}
                        existingLinkedTaskIds={predecessorLinks.map(l => l.source)}
                        dispatch={dispatch}
                        type="predecessor"
                        uiDensity={uiDensity}
                    />
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
