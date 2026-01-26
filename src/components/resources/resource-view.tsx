'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ProjectState, Task } from "@/lib/types";
import { Users } from "lucide-react";

export function ResourceView({ projectState }: { projectState: ProjectState }) {
    const { resources, assignments, tasks } = projectState;
    const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]));

    if (resources.length === 0) {
        return (
            <div className="p-4 border rounded-lg bg-muted/20 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                    No resources in this project.
                </p>
            </div>
        );
    }

    return (
        <Accordion type="multiple" className="w-full">
            {resources.map(resource => {
                const resourceAssignments = assignments.filter(a => a.resourceId === resource.id);
                return (
                    <AccordionItem value={resource.id} key={resource.id}>
                        <AccordionTrigger className="hover:no-underline px-2 py-2 text-base">
                            <div className="flex items-center justify-between w-full">
                                <span className="font-medium">{resource.name}</span>
                                <span className="text-muted-foreground text-sm mr-2">{resourceAssignments.length} tasks</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-0">
                            {resourceAssignments.length > 0 ? (
                                <ul className="pl-6 pr-2 py-1 space-y-1 text-sm">
                                    {resourceAssignments.map(assignment => {
                                        const task = taskMap.get(assignment.taskId);
                                        return (
                                            <li key={assignment.id} className="flex justify-between items-center py-1">
                                                <span className="truncate pr-2" title={task?.name}>{task?.name || 'Unknown Task'}</span>
                                                <span className="text-muted-foreground flex-shrink-0">{task?.duration}d</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="px-6 py-2 text-sm text-muted-foreground">Not assigned to any tasks.</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                );
            })}
        </Accordion>
    );
}
