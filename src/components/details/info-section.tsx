'use client';

import type { Task, ConstraintType, Calendar } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { EditableSelectCell } from '@/components/omni-gantt/editable-select-cell';
import { EditableDateCell } from '@/components/omni-gantt/editable-date-cell';

export function InfoSection({ task, dispatch, defaultCalendar, dateFormat }: { task: Task; dispatch: any, defaultCalendar: Calendar | null, dateFormat: string }) {
  const handleConstraintTypeChange = (newValue: string | null) => {
    const payload: Partial<Task> & { id: string } = {
        id: task.id,
        constraintType: newValue as ConstraintType | null,
    };
    // If a constraint is chosen that requires a date, and no date is set, default it to the task's start date
    if (newValue && !task.constraintDate) {
        payload.constraintDate = task.start;
    }
    // If constraint is removed, clear the date as well
    if (!newValue) {
        payload.constraintDate = null;
    }
    dispatch({ type: 'UPDATE_TASK', payload });
  };

  const handleConstraintDateChange = (newDate: Date | null) => {
      dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, constraintDate: newDate } });
  }

  const handleDeadlineChange = (newDate: Date | null) => {
      dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, deadline: newDate } });
  }

  const constraintOptions = [
    { value: 'Finish No Earlier Than', label: 'Finish No Earlier Than' },
    { value: 'Finish No Later Than', label: 'Finish No Later Than' },
    { value: 'Must Finish On', label: 'Must Finish On' },
    { value: 'Must Start On', label: 'Must Start On' },
    { value: 'Start No Earlier Than', label: 'Start No Earlier Than' },
    { value: 'Start No Later Than', label: 'Start No Later Than' },
  ];

  const hasConstraintDate = !!task.constraintType;

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
                        placeholder="As Soon As Possible"
                    />
                </div>
                 <div>
                    <Label htmlFor={`constraint-date-${task.id}`} className="text-sm">Constraint Date</Label>
                     <div className={!hasConstraintDate ? 'opacity-50 pointer-events-none' : ''}>
                         <EditableDateCell
                            value={task.constraintDate}
                            onSave={handleConstraintDateChange}
                            calendar={defaultCalendar}
                            dateFormat={dateFormat}
                        />
                    </div>
                </div>
            </div>
        </div>
        <div>
             <Label className="text-xs font-semibold text-muted-foreground uppercase">Deadline</Label>
            <div className="mt-2 grid grid-cols-2 gap-4 border p-4 rounded-md">
                 <div>
                    <Label htmlFor={`deadline-date-${task.id}`} className="text-sm">Deadline Date</Label>
                     <EditableDateCell
                        value={task.deadline}
                        onSave={handleDeadlineChange}
                        calendar={defaultCalendar}
                        dateFormat={dateFormat}
                    />
                </div>
                 <div />
            </div>
        </div>
    </div>
  );
}
