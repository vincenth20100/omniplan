'use client';

import type { Task, ConstraintType, Calendar } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EditableSelectCell } from '@/components/omni-gantt/editable-select-cell';
import { EditableDateCell } from '@/components/omni-gantt/editable-date-cell';

export function InfoSection({ task, dispatch, defaultCalendar }: { task: Task; dispatch: any, defaultCalendar: Calendar | null }) {
  const handleAdditionalNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({
      type: 'UPDATE_TASK',
      payload: { id: task.id, additionalNotes: e.target.value },
    });
  };

  const handleConstraintTypeChange = (newValue: string | null) => {
    const payload: Partial<Task> & { id: string } = {
        id: task.id,
        constraintType: newValue as ConstraintType | null,
    };
    // If changing to "None", also clear the date.
    if (!newValue) {
        payload.constraintDate = null;
    } 
    // If changing from "None" to something else, and there's no date, set it to the task's start date
    else if (!task.constraintDate) {
        payload.constraintDate = task.start;
    }
    dispatch({ type: 'UPDATE_TASK', payload });
  };

  const handleConstraintDateChange = (newDate: Date | null) => {
      dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, constraintDate: newDate } });
  }

  const constraintOptions = [
    { value: 'Start No Earlier Than', label: 'Start No Earlier Than' },
    { value: 'Must Start On', label: 'Must Start On' },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
        <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Constraints</Label>
            <div className="mt-2 grid grid-cols-2 gap-4 border p-4 rounded-md">
                 <div>
                    <Label htmlFor={`constraint-type-${task.id}`} className="text-sm">Constraint Type</Label>
                     <EditableSelectCell
                        value={task.constraintType || null}
                        onSave={handleConstraintTypeChange}
                        options={constraintOptions}
                        placeholder="None"
                    />
                </div>
                 <div>
                    <Label htmlFor={`constraint-date-${task.id}`} className="text-sm">Constraint Date</Label>
                     <div className={!task.constraintType ? 'opacity-50 pointer-events-none' : ''}>
                         <EditableDateCell
                            value={task.constraintDate}
                            onSave={handleConstraintDateChange}
                            calendar={defaultCalendar}
                        />
                    </div>
                </div>
            </div>
        </div>
        <div>
            <Label htmlFor="additional-notes" className="text-xs font-semibold text-muted-foreground uppercase">
                Additional Information
            </Label>
            <Textarea
                id="additional-notes"
                value={task.additionalNotes || ''}
                onChange={handleAdditionalNotesChange}
                placeholder="Add any persistent, high-level information about this task here..."
                className="mt-2"
                rows={5}
            />
        </div>
    </div>
  );
}
