'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import type { Task } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

// This is the content for a Popover, designed to be placed inside a PopoverContent.
export function RelationshipComboboxContent({
  allTasks,
  currentTaskId,
  excludedTaskIds,
  onSelectTask,
  searchPlaceholder = "Search by ID or name...",
}: {
  allTasks: Task[];
  currentTaskId: string;
  excludedTaskIds: string[];
  onSelectTask: (taskId: string) => void;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus the input when the component mounts
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const availableTasks = allTasks.filter(
    (t) =>
      t.id !== currentTaskId &&
      !excludedTaskIds.includes(t.id) &&
      (t.name.toLowerCase().includes(search.toLowerCase()) ||
       t.wbs?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <div className="p-2 border-b">
        <Input
          ref={inputRef}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8"
        />
      </div>
      <ScrollArea className="h-[200px]">
        <div className="p-1">
          {availableTasks.length > 0 ? (
            availableTasks.map((task) => (
              <div
                key={task.id}
                onMouseDown={(e) => e.preventDefault()} // Prevent input from blurring on click
                onClick={() => onSelectTask(task.id)}
                className="p-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                {task.wbs} - {task.name}
              </div>
            ))
          ) : (
            <div className="p-2 text-center text-sm text-muted-foreground">
              No tasks found.
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
