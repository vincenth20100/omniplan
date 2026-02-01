'use client';
import type { Link, Task, UiDensity, LinkType } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableCell } from '@/components/omni-gantt/editable-cell';
import { EditableSelectCell } from '@/components/omni-gantt/editable-select-cell';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { AddRelationshipRow } from './add-relationship-row';
import React from 'react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RelationshipComboboxContent } from './relationship-combobox';
import { useIsMobile } from '@/hooks/use-mobile';

export function SuccessorList({ currentTaskId, successorLinks, allTasks, dispatch, uiDensity, dateFormat }: { currentTaskId: string, successorLinks: Link[], allTasks: Task[], dispatch: any, uiDensity: UiDensity, dateFormat: string }) {
    const isMobile = useIsMobile();
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
    const [addPopoverOpen, setAddPopoverOpen] = React.useState(false);
    
    const [colWidths, setColWidths] = React.useState({
        id: 50,
        task: 200,
        type: 80,
        lag: 60,
        date: 110,
        actions: 40,
    });

    const handleResize = (columnId: keyof typeof colWidths) => (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const startWidth = colWidths[columnId];
        
        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const newWidth = startWidth + (currentX - startX);
            if (newWidth > 30) {
                 setColWidths(prev => ({...prev, [columnId]: newWidth}));
            }
        };

        const handleEnd = () => {
            document.removeEventListener('mousemove', handleMove as any);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove as any);
            document.removeEventListener('touchend', handleEnd);
        };

        document.addEventListener('mousemove', handleMove as any);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove as any);
        document.addEventListener('touchend', handleEnd);
    };


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
    
    const ResizableHeader = ({ id, name }: { id: keyof typeof colWidths, name: string }) => (
        <TableHead className="relative group/header select-none p-0 overflow-hidden">
            <div className={cn(cellInnerDivClass)}>
                <span>{name}</span>
            </div>
            <div 
                className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                onMouseDown={handleResize(id)}
                onTouchStart={handleResize(id)}
            />
        </TableHead>
    );

    if (isMobile) {
        return (
            <div className="flex flex-col gap-3 p-1">
                {successorLinks.map(link => {
                     const targetTask = taskMap.get(link.target);
                     const displayTask = targetTask || {
                         name: 'External Task',
                         wbs: 'EXT',
                         start: null,
                         finish: null
                     };

                     const getDateForLink = () => {
                        if (!targetTask) return null;
                        switch (link.type) {
                            case 'FS':
                            case 'SS':
                                return targetTask.start;
                            case 'FF':
                            case 'SF':
                                return targetTask.finish;
                            default:
                                return null;
                        }
                    };
                     const linkDate = getDateForLink();

                     return (
                         <div key={link.id} className="border rounded-md p-3 bg-card shadow-sm">
                             <div className="flex justify-between items-start mb-2">
                                <div className="flex flex-col min-w-0">
                                     <span className="font-semibold text-sm truncate">{displayTask.name}</span>
                                     <span className="text-xs text-muted-foreground">ID: {displayTask.wbs}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-2 -mt-2" onClick={() => dispatch({ type: 'REMOVE_LINK', payload: { linkId: link.id }})}>
                                     <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                             </div>

                             <div className="grid grid-cols-3 gap-3">
                                 <div>
                                     <span className="text-[10px] uppercase text-muted-foreground font-semibold">Type</span>
                                     <div className="border rounded h-8 mt-1">
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
                                 </div>
                                 <div>
                                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">Lag</span>
                                      <div className="border rounded h-8 mt-1 px-2">
                                        <EditableCell
                                            value={`${link.lag || 0}`}
                                            onSave={(newValue) => {
                                                const newLag = parseInt(newValue, 10);
                                                if (!isNaN(newLag)) {
                                                    dispatch({ type: 'UPDATE_LINK', payload: { id: link.id, lag: newLag } });
                                                }
                                            }}
                                            className="text-right w-full text-sm"
                                        />
                                      </div>
                                 </div>
                                 <div>
                                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">Date</span>
                                      <div className="h-8 mt-1 flex items-center text-xs text-muted-foreground truncate">
                                        {linkDate ? format(linkDate, dateFormat) : '-'}
                                      </div>
                                 </div>
                             </div>
                         </div>
                     );
                })}

                <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
                    <PopoverTrigger asChild>
                         <Button variant="outline" className="w-full border-dashed text-muted-foreground">
                            <Plus className="h-4 w-4 mr-2" /> Add Successor
                         </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] sm:w-[400px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                         <RelationshipComboboxContent
                            allTasks={allTasks}
                            currentTaskId={currentTaskId}
                            excludedTaskIds={successorLinks.map(l => l.target)}
                            onSelectTask={(newTargetId) => {
                                dispatch({
                                    type: 'ADD_LINK',
                                    payload: {
                                        source: currentTaskId,
                                        target: newTargetId,
                                        type: 'FS',
                                        lag: 0,
                                    }
                                });
                                setAddPopoverOpen(false);
                            }}
                         />
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    return (
        <ScrollArea className="border rounded-md min-h-0 w-full">
            <div className="min-w-[540px]">
                <Table style={{ tableLayout: 'fixed' }} className="w-auto">
                    <colgroup>
                    <col style={{ width: `${colWidths.id}px` }} />
                    <col style={{ width: `${colWidths.task}px` }} />
                    <col style={{ width: `${colWidths.type}px` }} />
                    <col style={{ width: `${colWidths.lag}px` }} />
                    <col style={{ width: `${colWidths.date}px` }} />
                    <col style={{ width: `${colWidths.actions}px` }} />
                </colgroup>
                <TableHeader>
                    <TableRow 
                        data-density={uiDensity}
                        className={cn(
                            "data-[density=large]:h-12",
                            "data-[density=medium]:h-10",
                            "data-[density=compact]:h-8"
                        )}
                    >
                        <ResizableHeader id="id" name="ID" />
                        <ResizableHeader id="task" name="Task" />
                        <ResizableHeader id="type" name="Type" />
                        <ResizableHeader id="lag" name="Lag" />
                        <ResizableHeader id="date" name="Date" />
                        <ResizableHeader id="actions" name="" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {successorLinks.map(link => {
                        const targetTask = taskMap.get(link.target);
                        const displayTask = targetTask || {
                             name: 'External Task',
                             wbs: 'EXT',
                             start: null,
                             finish: null
                        };

                        const getDateForLink = () => {
                            if (!targetTask) return null;
                            switch (link.type) {
                                case 'FS':
                                case 'SS':
                                    return targetTask.start;
                                case 'FF':
                                case 'SF':
                                    return targetTask.finish;
                                default:
                                    return null;
                            }
                        };
                        const linkDate = getDateForLink();
                        
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
                                    <div className={cellInnerDivClass}>{displayTask.wbs || 'N/A'}</div>
                                </TableCell>
                                <TableCell className={cellClass} title={displayTask.name}>
                                     <Popover open={editingLinkId === link.id} onOpenChange={(open) => !open && setEditingLinkId(null)}>
                                        <PopoverTrigger asChild>
                                            <div
                                                onClick={() => setEditingLinkId(link.id)}
                                                className={cn(cellInnerDivClass, "cursor-pointer")}
                                            >
                                                {displayTask.name}
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] sm:w-[400px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                                                <RelationshipComboboxContent
                                                allTasks={allTasks}
                                                currentTaskId={currentTaskId}
                                                excludedTaskIds={successorLinks.map(l => l.target).filter(id => id !== link.target)}
                                                onSelectTask={(newTargetId) => {
                                                    dispatch({ type: 'UPDATE_LINK', payload: { id: link.id, target: newTargetId } });
                                                    setEditingLinkId(null);
                                                }}
                                                />
                                        </PopoverContent>
                                    </Popover>
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
                                    <div className={cellInnerDivClass}>
                                        {linkDate ? format(linkDate, dateFormat) : ''}
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
                        existingLinkedTaskIds={successorLinks.map(l => l.target)}
                        dispatch={dispatch}
                        type="successor"
                        uiDensity={uiDensity}
                    />
                </TableBody>
                </Table>
            </div>
        </ScrollArea>
    );
}
