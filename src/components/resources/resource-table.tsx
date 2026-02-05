'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, User, ArrowUp, ArrowDown } from 'lucide-react';
import type { ResourceUsageRow, Resource } from '@/lib/types';
import { Input } from "@/components/ui/input";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { ScrollBar } from "@/components/ui/scroll-area";

interface ResourceTableProps {
    rows: ResourceUsageRow[];
    expandedResourceIds: Set<string>;
    onToggleExpand: (resourceId: string) => void;
    viewportRef?: React.RefObject<HTMLDivElement>;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;

    // Sorting & Filtering
    sortColumn?: string | null;
    sortDirection?: 'asc' | 'desc' | null;
    onSort?: (columnId: string) => void;

    filters?: Record<string, string>;
    onFilterChange?: (columnId: string, value: string) => void;
}

export function ResourceTable({
    rows,
    expandedResourceIds,
    onToggleExpand,
    viewportRef,
    onScroll,
    sortColumn,
    sortDirection,
    onSort,
    filters = {},
    onFilterChange
}: ResourceTableProps) {
    const ROW_HEIGHT = 40;

    const columns = [
        { id: 'name', name: 'Resource Name', width: 250 },
        { id: 'type', name: 'Type', width: 100 },
        { id: 'maxUnits', name: 'Max Units', width: 100 },
        { id: 'totalWork', name: 'Total Work', width: 100 },
    ];

    const totalWidth = columns.reduce((acc, col) => acc + col.width, 0);

    return (
        <div className="flex flex-col h-full border-r bg-background">
             {/* Header is sticky or separate? In TaskTable it's inside the scroll area but sticky.
                 But here we use ResizablePanel which might constrain us.
                 Let's put the header outside the scroll area for simpler implementation or stick to TaskTable way.
                 TaskTable puts TableHeader inside Table, sticky top-0.
             */}
            <ScrollAreaPrimitive.Root className="flex-1 w-full relative overflow-hidden bg-background">
                <ScrollAreaPrimitive.Viewport
                    ref={viewportRef}
                    className="h-full w-full rounded-[inherit]"
                    onScroll={onScroll}
                >
                    <Table className="border-collapse table-fixed" style={{ width: totalWidth }}>
                        <colgroup>
                            {columns.map(col => <col key={col.id} style={{ width: col.width }} />)}
                        </colgroup>
                        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                            <TableRow>
                                {columns.map(col => (
                                    <TableHead
                                        key={col.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors h-10"
                                        onClick={() => onSort?.(col.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {col.name}
                                            {sortColumn === col.id && (
                                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            )}
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                            <TableRow>
                                {columns.map(col => (
                                    <TableHead key={`${col.id}-filter`} className="p-1 h-9 bg-card border-b">
                                         <Input
                                            className="h-7 text-xs px-2"
                                            placeholder="Filter..."
                                            value={filters[col.id] || ''}
                                            onChange={(e) => onFilterChange?.(col.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                         />
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map(row => {
                                const isResource = row.type === 'resource';
                                return (
                                    <TableRow
                                        key={row.id}
                                        style={{ height: ROW_HEIGHT }}
                                        className={cn(
                                            isResource ? "bg-muted/20 font-medium hover:bg-muted/30" : "hover:bg-muted/10 text-muted-foreground"
                                        )}
                                    >
                                        <TableCell className="p-0 px-2 overflow-hidden border-r">
                                            <div className="flex items-center gap-2" style={{ paddingLeft: `${row.level * 20}px` }}>
                                                 {isResource && (
                                                    <button onClick={() => onToggleExpand(row.resourceId)} className="p-0.5 hover:bg-muted rounded">
                                                        {expandedResourceIds.has(row.resourceId) ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
                                                    </button>
                                                )}
                                                {isResource ? <User className="h-3 w-3 text-primary shrink-0" /> : <div className="w-4" />}
                                                <span className="truncate text-sm">{row.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-0 px-2 border-r text-sm">
                                            {isResource ? (row.data as Resource).type : ''}
                                        </TableCell>
                                        <TableCell className="p-0 px-2 border-r text-right text-sm">
                                            {isResource ? `${((row.data as Resource).availability || 1) * 100}%` : ''}
                                        </TableCell>
                                        <TableCell className="p-0 px-2 border-r text-right text-sm">
                                            {row.totalWork}h
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ScrollAreaPrimitive.Viewport>
                <ScrollBar orientation="vertical" />
                <ScrollBar orientation="horizontal" />
            </ScrollAreaPrimitive.Root>
        </div>
    );
}
