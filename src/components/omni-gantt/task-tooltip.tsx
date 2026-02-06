'use client';
import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Task, ColumnSpec, Resource, Assignment, TooltipFieldSetting, Link } from "@/lib/types";
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
    links?: Link[];
    tasks?: Task[];
}

export const TaskTooltip = ({ task, tooltipFields, tooltipConfig, dateFormat = 'MMM d, yyyy', children, columns, resources, assignments, links, tasks }: TaskTooltipProps) => {
    let activeConfig: TooltipFieldSetting[] = [];

    if (tooltipConfig && tooltipConfig.length > 0) {
        activeConfig = tooltipConfig;
    } else if (tooltipFields && tooltipFields.length > 0) {
        activeConfig = tooltipFields.map(f => ({ id: f, field: f, label: '' }));
    }

    if (activeConfig.length === 0) {
        return <>{children}</>;
    }

    const renderContent = (setting: TooltipFieldSetting) => {
        const { field } = setting;

        // Standard fields
        switch (field) {
            case 'name': return task.name;
            case 'start': return format(task.start, dateFormat);
            case 'finish': return format(task.finish, dateFormat);
            case 'duration': return formatDuration(task.duration, task.durationUnit);
            case 'percentComplete': return `${task.percentComplete}%`;
            case 'status': return task.status;
            case 'wbs': return task.wbs;
            case 'notes': return (task.notes && task.notes.length > 0) ? "Has notes" : null;
            case 'resourceNames': {
                if (!resources || !assignments) return null;
                const taskAssignments = assignments.filter(a => a.taskId === task.id);
                if (taskAssignments.length === 0) return null;
                const resourceMap = new Map(resources.map(r => [r.id, r.name]));
                return taskAssignments.map(a => resourceMap.get(a.resourceId)).filter(Boolean).join(', ');
            }
            case 'predecessors':
            case 'successors': {
                 if (!links || !tasks) return null;
                 const isPredecessors = field === 'predecessors';
                 const relatedLinks = isPredecessors
                    ? links.filter(l => l.target === task.id)
                    : links.filter(l => l.source === task.id);

                 if (relatedLinks.length === 0) return null;

                 const taskMap = new Map(tasks.map(t => [t.id, t]));
                 const fieldsToShow = setting.relatedTaskFields && setting.relatedTaskFields.length > 0
                    ? setting.relatedTaskFields
                    : ['name'];

                 return relatedLinks.map(l => {
                     const relatedId = isPredecessors ? l.source : l.target;
                     const relatedTask = taskMap.get(relatedId);
                     if (!relatedTask) return 'Unknown';

                     return fieldsToShow.map(f => {
                         switch(f) {
                             case 'id': return relatedTask.wbs || relatedTask.id;
                             case 'name': return relatedTask.name;
                             case 'start': return format(relatedTask.start, dateFormat);
                             case 'finish': return format(relatedTask.finish, dateFormat);
                             default: return '';
                         }
                     }).join(' ');
                 }).join(', ');
            }
        }

        // Custom attributes
         if (columns) {
            const column = columns.find(c => c.id === field);
            if (column) {
                if (field.startsWith('custom-')) {
                     return task.customAttributes?.[field];
                }
                if (field === 'cost') {
                     const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
                     return currencyFormatter.format(task.cost || 0);
                }
            }
        }
        return null;
    };

    // Grouping logic
    const groupedConfig: { settings: TooltipFieldSetting[] }[] = [];
    activeConfig.forEach((setting) => {
        if (setting.displayInline && groupedConfig.length > 0) {
             groupedConfig[groupedConfig.length - 1].settings.push(setting);
        } else {
             groupedConfig.push({ settings: [setting] });
        }
    });

    return (
        <TooltipProvider delayDuration={1000}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                <TooltipContent className="flex flex-col gap-0.5 text-xs p-2 max-w-xs break-words">
                     {groupedConfig.map((group, groupIndex) => {
                         // Filter out items with no content to avoid rendering empty separators/labels
                         const validSettings = group.settings.map(s => ({ setting: s, content: renderContent(s) })).filter(item => item.content !== null && item.content !== undefined && item.content !== '');

                         if (validSettings.length === 0) return null;

                         return (
                            <div key={groupIndex}>
                                {validSettings.map(({ setting, content }, settingIndex) => {
                                     const isFirst = settingIndex === 0;
                                     // Use nbsp for space to prevent collapse
                                     const separator = (!isFirst) ? <span className="mx-1">{setting.inlineSeparator || '\u00A0'}</span> : null;

                                     const label = setting.label;
                                     const showLabel = !!label;

                                     return (
                                         <React.Fragment key={setting.id || setting.field}>
                                             {separator}
                                             <span>
                                                 {showLabel && <span className="text-muted-foreground mr-1">{label}:</span>}
                                                 {setting.field === 'name' ? <span className="font-semibold">{content}</span> : content}
                                             </span>
                                         </React.Fragment>
                                     );
                                })}
                            </div>
                         );
                     })}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
