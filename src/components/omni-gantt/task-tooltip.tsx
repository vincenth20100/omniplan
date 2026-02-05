'use client';
import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Task } from "@/lib/types";
import { format } from "date-fns";
import { formatDuration } from "@/lib/duration";

interface TaskTooltipProps {
    task: Task;
    tooltipFields?: string[];
    dateFormat?: string;
    children: React.ReactNode;
}

export const TaskTooltip = ({ task, tooltipFields, dateFormat = 'MMM d, yyyy', children }: TaskTooltipProps) => {
    if (!tooltipFields || tooltipFields.length === 0) {
        return <>{children}</>;
    }

    const renderField = (field: string) => {
        switch (field) {
            case 'name': return <div className="font-semibold">{task.name}</div>;
            case 'start': return <div><span className="text-muted-foreground">Start:</span> {format(task.start, dateFormat)}</div>;
            case 'finish': return <div><span className="text-muted-foreground">Finish:</span> {format(task.finish, dateFormat)}</div>;
            case 'duration': return <div><span className="text-muted-foreground">Duration:</span> {formatDuration(task.duration, task.durationUnit)}</div>;
            case 'percentComplete': return <div><span className="text-muted-foreground">Progress:</span> {task.percentComplete}%</div>;
            case 'status': return <div><span className="text-muted-foreground">Status:</span> {task.status}</div>;
            case 'wbs': return task.wbs ? <div><span className="text-muted-foreground">WBS:</span> {task.wbs}</div> : null;
            case 'notes': return (task.notes && task.notes.length > 0) ? <div className="italic text-xs mt-1 border-t pt-1 border-border">Has notes</div> : null;
            default: return null;
        }
    };

    return (
        <TooltipProvider delayDuration={1000}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-0.5 text-xs p-2">
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
