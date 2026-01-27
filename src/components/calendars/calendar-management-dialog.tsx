'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { CalendarView } from "./calendar-view";
import type { ProjectState } from "@/lib/types";
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function CalendarManagementDialog({
  open,
  onOpenChange,
  projectState,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectState: ProjectState;
  dispatch: any;
}) {
  const { calendars, defaultCalendarId } = projectState;
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(defaultCalendarId);
  const selectedCalendar = calendars.find(c => c.id === selectedCalendarId) || null;

  useEffect(() => {
    if (open) {
      setSelectedCalendarId(defaultCalendarId);
    }
  }, [open, defaultCalendarId]);

  const handleAddCalendar = () => {
    dispatch({ type: 'ADD_CALENDAR' });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Change Working Time</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between pb-4 border-b">
            <div className="flex items-center gap-2">
                <label htmlFor="calendar-select" className="text-sm font-medium">For calendar:</label>
                <Select value={selectedCalendarId || ''} onValueChange={setSelectedCalendarId}>
                    <SelectTrigger id="calendar-select" className="w-[300px]">
                        <SelectValue placeholder="Select a calendar" />
                    </SelectTrigger>
                    <SelectContent>
                        {calendars.map(calendar => (
                            <SelectItem key={calendar.id} value={calendar.id}>
                                {calendar.name} {calendar.id === defaultCalendarId && '(Project Calendar)'}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button variant="outline" onClick={handleAddCalendar}>Create New Calendar...</Button>
        </div>

        <div className="flex-grow overflow-auto py-4">
            {selectedCalendar ? (
              <CalendarView 
                key={selectedCalendar.id}
                calendar={selectedCalendar}
                dispatch={dispatch} 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Select or create a calendar to view its details.</p>
              </div>
            )}
        </div>
        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild>
            <Button type="button">
              OK
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
