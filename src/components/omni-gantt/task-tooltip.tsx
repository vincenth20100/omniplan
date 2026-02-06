'use client';
import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Task, ColumnSpec, Resource, Assignment, TooltipFieldSetting } from "@/lib/types";
import { format } from "date-fns";
import { formatDuration } from "@/lib/duration";

interface TaskTooltipProps {
    task: Task;
    tooltipFields?: string[];
    tooltipConfig?: TooltipFieldSetting[];
    dateFormat?: string;
    children: React.ReactNode;
    columns?: ColumnSpec[];
    resources?: Resource[];
    assignments?: Assignment[];
}

export const TaskTooltip = ({ task, tooltipFields, tooltipConfig, dateFormat = 'MMM d, yyyy', children, columns, resources, assignments }: TaskTooltipProps) => {
    let activeConfig: TooltipFieldSetting[] = [];

    if (tooltipConfig && tooltipConfig.length > 0) {
        activeConfig = tooltipConfig;
    } else if (tooltipFields && tooltipFields.length > 0) {
        activeConfig = tooltipFields.map(f => ({ id: f, field: f, label: '' }));
    }

    if (activeConfig.length === 0) {
        return <>{children}</>;
    }

    const renderField = (setting: TooltipFieldSetting) => {
        const { field, label } = setting;

        const LabelWrapper = ({ children }: { children: React.ReactNode }) => (
            <span className="text-muted-foreground">{label ? `${label}:` : children}</span>
        );

        // Standard fields
        switch (field) {
            case 'name': return <div className="font-semibold">{label ? <><span className="text-muted-foreground font-normal">{label}:</span> </> : null}{task.name}</div>;
            case 'start': return <div><LabelWrapper>Start:</LabelWrapper> {format(task.start, dateFormat)}</div>;
            case 'finish': return <div><LabelWrapper>Finish:</LabelWrapper> {format(task.finish, dateFormat)}</div>;
            case 'duration': return <div><LabelWrapper>Duration:</LabelWrapper> {formatDuration(task.duration, task.durationUnit)}</div>;
            case 'percentComplete': return <div><LabelWrapper>Progress:</LabelWrapper> {task.percentComplete}%</div>;
            case 'status': return <div><LabelWrapper>Status:</LabelWrapper> {task.status}</div>;
            case 'wbs': return task.wbs ? <div><LabelWrapper>WBS:</LabelWrapper> {task.wbs}</div> : null;
            case 'notes': return (task.notes && task.notes.length > 0) ? <div className="italic text-xs mt-1 border-t pt-1 border-border">{label || "Has notes"}</div> : null;
            case 'resourceNames': {
                if (!resources || !assignments) return null;
                const taskAssignments = assignments.filter(a => a.taskId === task.id);
                if (taskAssignments.length === 0) return null;
                const resourceMap = new Map(resources.map(r => [r.id, r.name]));
                const names = taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
                return <div><LabelWrapper>Resources:</LabelWrapper> {names}</div>;
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
                    const displayLabel = label || column.name;
                    return <div><span className="text-muted-foreground">{displayLabel}:</span> {value}</div>;
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
                    {activeConfig.map(setting => (
                        <React.Fragment key={setting.id || setting.field}>
                            {renderField(setting)}
                        </React.Fragment>
                    ))}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
