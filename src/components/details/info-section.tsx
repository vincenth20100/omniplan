'use client';

import type { Task } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function InfoSection({ task, dispatch }: { task: Task; dispatch: any }) {
  const handleAdditionalNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        id: task.id,
        additionalNotes: e.target.value,
      },
    });
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <Label htmlFor="additional-notes" className="text-xs font-semibold text-muted-foreground">
          ADDITIONAL INFORMATION
        </Label>
        <Textarea
          id="additional-notes"
          value={task.additionalNotes || ''}
          onChange={handleAdditionalNotesChange}
          placeholder="Add any persistent, high-level information about this task here..."
          className="mt-1"
          rows={5}
        />
      </div>
    </div>
  );
}
