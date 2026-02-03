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
import { useIsMobile } from '@/hooks/use-mobile';

export function ResourceSection({ task, assignments, resources, dispatch }: { task: Task; assignments: Assignment[], resources: Resource[], dispatch: any }) {
  const isMobile = useIsMobile();
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

  const handleCreateResource = (name: string) => {
      const newResourceId = crypto.randomUUID();
      // Heuristic: if name is short (<=3 chars), treat as initials. Otherwise as name.
      const initials = name.length <= 3 ? name.toUpperCase() : name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

      dispatch({
          type: 'ADD_RESOURCE',
          payload: { id: newResourceId, name: name, initials: initials }
      });

      dispatch({
          type: 'ADD_ASSIGNMENT',
          payload: { taskId: task.id, resourceId: newResourceId, units: 1 }
      });
      setOpen(false);
  };
  
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
      const updates: Partial<Task> & { id: string } = { id: task.id, schedulingType: isEffortDriven ? 'effort' : 'duration' };

      if (isEffortDriven) {
          // Switching TO Effort Driven.
          // Calculate current work from duration and units to preserve it.
          const totalUnits = assignedResources.reduce((sum, a) => sum + (a.units || 0), 0);
          const effectiveUnits = totalUnits > 0 ? totalUnits : 1;
          const currentDuration = task.duration || 0;

          // Work (hours) = Duration (days) * 8 (hours/day) * Units
          const calculatedWork = currentDuration * 8 * effectiveUnits;

          updates.work = calculatedWork;
      }

      dispatch({
          type: 'UPDATE_TASK',
          payload: updates
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
  
  const renderMobileContent = () => (
    <div className="flex-grow overflow-y-auto min-h-0">
       <div className="flex flex-col gap-3 p-1">
           {assignedResources.map(assignment => {
                const assignmentWork = isEffortDriven
                    ? (task.work || 0) * ((assignment.units || 0) / (totalUnits || 1))
                    : (task.duration || 0) * (assignment.units || 0) * 8; // Assuming 8hr work day

               return (
                   <div key={assignment.id} className="border rounded-md p-3 bg-card shadow-sm">
                       <div className="flex justify-between items-start mb-2">
                           <div className="flex flex-col min-w-0">
                               <span className="font-semibold text-sm truncate">{assignment.resource?.name}</span>
                               <span className="text-xs text-muted-foreground">{assignment.resource?.initials}</span>
                           </div>
                           <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-2 -mt-2" onClick={() => handleRemoveAssignment(assignment.id)}>
                               <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                           <div>
                               <span className="text-[10px] uppercase text-muted-foreground font-semibold">Units</span>
                               <div className="border rounded h-8 mt-1 px-2 flex items-center">
                                   <EditableCell
                                       value={`${(assignment.units || 0) * 100}%`}
                                       onSave={(newValue) => {
                                           const numericValue = parseFloat(newValue.replace('%', ''));
                                           if (!isNaN(numericValue)) {
                                               handleUpdateAssignment(assignment.id, numericValue / 100);
                                           }
                                       }}
                                       className="text-right w-full text-sm"
                                   />
                               </div>
                           </div>
                           <div>
                               <span className="text-[10px] uppercase text-muted-foreground font-semibold">Work</span>
                               <div className="h-8 mt-1 flex items-center text-sm text-right justify-end">
                                  {assignmentWork.toFixed(1)}h
                               </div>
                           </div>
                       </div>
                   </div>
               );
           })}

           <Popover open={open} onOpenChange={setOpen} modal={true}>
              <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full border-dashed text-muted-foreground">
                      <Plus className="h-4 w-4 mr-2" /> Assign Resource
                  </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] sm:w-[400px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <ResourceComboboxContent
                      allResources={resources}
                      excludedResourceIds={assignedResources.map(a => a.resourceId)}
                      onSelectResource={handleAddAssignment}
                      onCreate={handleCreateResource}
                  />
              </PopoverContent>
           </Popover>
       </div>
    </div>
  );

  const renderDesktopContent = () => (
    <div className="flex-grow flex flex-col gap-2 min-h-0">
         <h3 className="text-sm font-semibold">Resource Assignments</h3>
         <ScrollArea className="border rounded-md min-h-0 w-full flex-1">
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
                            <Popover open={open} onOpenChange={setOpen} modal={true}>
                            <PopoverTrigger asChild>
                                <div className="relative w-full cursor-text" onClick={() => setOpen(true)}>
                                    <Input
                                        placeholder="Assign Resource..."
                                        className="w-full h-8 border-dashed text-xs focus-visible:ring-1 bg-transparent pr-8 cursor-pointer"
                                        readOnly
                                    />
                                    <Plus className="absolute right-2 top-2.5 h-3 w-3 text-muted-foreground pointer-events-none" />
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] sm:w-[400px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                                <ResourceComboboxContent
                                    allResources={resources}
                                    excludedResourceIds={assignedResources.map(a => a.resourceId)}
                                    onSelectResource={handleAddAssignment}
                                    onCreate={handleCreateResource}
                                />
                            </PopoverContent>
                            </Popover>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
         </ScrollArea>
    </div>
  );

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

        {/* Resources Content */}
        {isMobile ? renderMobileContent() : renderDesktopContent()}

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
