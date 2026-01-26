'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ProjectState, Resource } from "@/lib/types";
import { EditableCell } from "@/components/omni-gantt/editable-cell";
import { EditableSelectCell } from "@/components/omni-gantt/editable-select-cell";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ResourceView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { resources } = projectState;

    const handleAddResource = () => {
        dispatch({ type: 'ADD_RESOURCE' });
    };

    const handleRemoveResource = (resourceId: string) => {
        dispatch({ type: 'REMOVE_RESOURCE', payload: { resourceId } });
    };

    const resourceTypeOptions = [
        { value: 'Work', label: 'Work' },
        { value: 'Material', label: 'Material' },
        { value: 'Cost', label: 'Cost' },
    ];
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow">
                <ScrollArea className="h-[calc(80vh-150px)]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-[120px]">Type</TableHead>
                                <TableHead className="w-[120px]">Cost/Hour</TableHead>
                                <TableHead className="w-[120px]">Availability</TableHead>
                                <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {resources.map(resource => (
                                <TableRow key={resource.id}>
                                    <TableCell>
                                        <EditableCell 
                                            value={resource.name}
                                            onSave={(newValue) => dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, name: newValue }})}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <EditableSelectCell
                                            value={resource.type}
                                            onSave={(newValue) => dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, type: newValue as Resource['type'] }})}
                                            options={resourceTypeOptions}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <EditableCell 
                                            value={String(resource.costPerHour || 0)}
                                            onSave={(newValue) => dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, costPerHour: parseFloat(newValue) || 0 }})}
                                            className="text-right"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <EditableCell 
                                            value={`${(resource.availability || 1) * 100}%`}
                                            onSave={(newValue) => {
                                                const percentage = parseFloat(newValue.replace('%', ''));
                                                if (!isNaN(percentage)) {
                                                    dispatch({ type: 'UPDATE_RESOURCE', payload: { id: resource.id, availability: percentage / 100 }})
                                                }
                                            }}
                                            className="text-right"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveResource(resource.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            <div className="mt-4">
                <Button onClick={handleAddResource}>
                    <Plus className="mr-2 h-4 w-4" /> Add Resource
                </Button>
            </div>
        </div>
    );
}
