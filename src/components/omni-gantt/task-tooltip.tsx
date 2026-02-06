'use client';
import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Task, ColumnSpec, Resource, Assignment } from "@/lib/types";
import { format } from "date-fns";
import { formatDuration } from "@/lib/duration";

interface TaskTooltipProps {
    task: Task;
    tooltipFields?: string[];
    dateFormat?: string;
    children: React.ReactNode;
    columns?: ColumnSpec[];
    resources?: Resource[];
    assignments?: Assignment[];
}

export const TaskTooltip = ({ task, tooltipFields, dateFormat = 'MMM d, yyyy', children, columns, resources, assignments }: TaskTooltipProps) => {
    if (!tooltipFields || tooltipFields.length === 0) {
        return <>{children}</>;
    }

    const renderField = (field: string) => {
        // Standard fields
        switch (field) {
            case 'name': return <div className="font-semibold">{task.name}</div>;
            case 'start': return <div><span className="text-muted-foreground">Start:</span> {format(task.start, dateFormat)}</div>;
            case 'finish': return <div><span className="text-muted-foreground">Finish:</span> {format(task.finish, dateFormat)}</div>;
            case 'duration': return <div><span className="text-muted-foreground">Duration:</span> {formatDuration(task.duration, task.durationUnit)}</div>;
            case 'percentComplete': return <div><span className="text-muted-foreground">Progress:</span> {task.percentComplete}%</div>;
            case 'status': return <div><span className="text-muted-foreground">Status:</span> {task.status}</div>;
            case 'wbs': return task.wbs ? <div><span className="text-muted-foreground">WBS:</span> {task.wbs}</div> : null;
            case 'notes': return (task.notes && task.notes.length > 0) ? <div className="italic text-xs mt-1 border-t pt-1 border-border">Has notes</div> : null;
            case 'resourceNames': {
                if (!resources || !assignments) return null;
                const taskAssignments = assignments.filter(a => a.taskId === task.id);
                if (taskAssignments.length === 0) return null;
                const resourceMap = new Map(resources.map(r => [r.id, r.name]));
                const names = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
                return <div><span className="text-muted-foreground">Resources:</span> {names}</div>;
            }
        }

        // Custom attributes and other column fields
        if (columns) {
            const column = columns.find(c => c.id === field);
            if (column) {
                let value: React.ReactNode = null;
                if (field.startsWith('custom-')) {
                     value = task.customAttributes?.[field];
                } else {
                    if (field === 'cost') {
                         const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
                         value = currencyFormatter.format(task.cost || 0);
                    }
                }

                if (value !== null && value !== undefined && value !== '') {
                    return <div><span className="text-muted-foreground">{column.name}:</span> {value}</div>;
                }
            }
        }

        return null;
    };

    return (
        <TooltipProvider delayDuration={1000}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-0.5 text-xs p-2 max-w-xs break-words">
                    {tooltipFields.map(field => (
                        <React.Fragment key={field}>
                            {renderField(field)}
                        </React.Fragment>
                    ))}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
