'use client';

import type { Task, Resource, Assignment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableCell } from '@/components/omni-gantt/editable-cell';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';
import { ResourceComboboxContent } from './resource-combobox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';

export function ResourceSection({ task, assignments, resources, dispatch }: { task: Task; assignments: Assignment[], resources: Resource[], dispatch: any }) {
  const [open, setOpen] = useState(false);
  const resourceMap = new Map(resources.map(r => [r.id, r]));

  const assignedResources = assignments.map(a => {
    const resource = resourceMap.get(a.resourceId);
    return { ...a, resource };
  }).filter(a => a.resource);

  const handleAddAssignment = (resourceId: string) => {
    dispatch({
        type: 'ADD_ASSIGNMENT',
        payload: { taskId: task.id, resourceId, units: 1 }
    });
    setOpen(false);
  }
  
  const handleUpdateAssignment = (assignmentId: string, newUnits: number) => {
      dispatch({
          type: 'UPDATE_ASSIGNMENT',
          payload: { id: assignmentId, units: newUnits }
      });
  }
  
  const handleRemoveAssignment = (assignmentId: string) => {
      dispatch({
          type: 'REMOVE_ASSIGNMENT',
          payload: { id: assignmentId }
      });
  }

  const handleSchedulingTypeChange = (isEffortDriven: boolean) => {
      dispatch({
          type: 'UPDATE_TASK',
          payload: { id: task.id, schedulingType: isEffortDriven ? 'effort' : 'duration' }
      });
  }
  
  const handleWorkChange = (workValue: number) => {
      if (!isNaN(workValue) && workValue >= 0) {
          dispatch({
              type: 'UPDATE_TASK',
              payload: { id: task.id, work: workValue }
          });
      }
  }

  const totalUnits = assignedResources.reduce((sum, a) => sum + (a.units || 0), 0);
  const isEffortDriven = task.schedulingType === 'effort';
  
  return (
    <div className="flex flex-col h-full gap-4">
        {/* Scheduling Type */}
        <div className="border p-4 rounded-md flex items-center justify-between">
            <div className="space-y-1">
                <Label htmlFor="scheduling-type" className="font-semibold">
                    Scheduling Type
                </Label>
                <p className="text-xs text-muted-foreground">
                    {isEffortDriven ? 'Duration is calculated from Work and Resource Units.' : 'Work is calculated from Duration and Resource Units.'}
                </p>
            </div>
            <div className="flex items-center gap-2">
                 <Label htmlFor="scheduling-type" className={cn(!isEffortDriven && "text-primary font-medium")}>Duration Driven</Label>
                 <Switch
                    id="scheduling-type"
                    checked={isEffortDriven}
                    onCheckedChange={handleSchedulingTypeChange}
                 />
                 <Label htmlFor="scheduling-type" className={cn(isEffortDriven && "text-primary font-medium")}>Effort Driven</Label>
            </div>
        </div>

        {/* Resources Table */}
        <div className="flex-grow flex flex-col gap-2">
             <h3 className="text-sm font-semibold">Resource Assignments</h3>
             <ScrollArea className="border rounded-md min-h-0 w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Initials</TableHead>
                            <TableHead>Resource Name</TableHead>
                            <TableHead className="w-[120px] text-right">Units</TableHead>
                            <TableHead className="w-[120px] text-right">Work</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assignedResources.map(assignment => {
                            const assignmentWork = isEffortDriven 
                                ? (task.work || 0) * ((assignment.units || 0) / (totalUnits || 1))
                                : (task.duration || 0) * (assignment.units || 0) * 8; // Assuming 8hr work day

                            return (
                                <TableRow key={assignment.id}>
                                    <TableCell className="font-medium">{assignment.resource?.initials}</TableCell>
                                    <TableCell>{assignment.resource?.name}</TableCell>
                                    <TableCell className="text-right">
                                        <EditableCell 
                                            value={`${(assignment.units || 0) * 100}%`}
                                            onSave={(newValue) => {
                                                const numericValue = parseFloat(newValue.replace('%', ''));
                                                if (!isNaN(numericValue)) {
                                                    handleUpdateAssignment(assignment.id, numericValue / 100);
                                                }
                                            }}
                                            className="text-right w-full"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">{assignmentWork.toFixed(1)}h</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveAssignment(assignment.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                         <TableRow>
                            <TableCell colSpan={5} className="p-1">
                                <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    className="w-full justify-between h-8 border-dashed text-xs text-muted-foreground"
                                    >
                                    <span className="flex items-center gap-2">
                                        <Plus className="h-3 w-3" />
                                        Assign Resource
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <ResourceComboboxContent
                                        allResources={resources}
                                        excludedResourceIds={assignedResources.map(a => a.resourceId)}
                                        onSelectResource={handleAddAssignment}
                                    />
                                </PopoverContent>
                                </Popover>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
             </ScrollArea>
        </div>

        {/* Summary Footer */}
        <div className="border p-4 rounded-md flex items-center justify-end gap-4 text-sm font-medium">
            <Label htmlFor="total-work">Total Work:</Label>
            <Input
                id="total-work"
                type="number"
                value={task.work || 0}
                onChange={(e) => handleWorkChange(parseFloat(e.target.value))}
                disabled={!isEffortDriven}
                className="w-24 h-8"
                min={0}
            />
             <Label htmlFor="total-duration">Total Duration:</Label>
             <Input
                id="total-duration"
                value={task.duration || 0}
                className="w-24 h-8"
                disabled
            />
        </div>
    </div>
  );
}
