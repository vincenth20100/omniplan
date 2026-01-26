'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarView } from "./calendar-view";
import type { ProjectState, Calendar as CalendarType } from "@/lib/types";
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditableCell } from "@/components/omni-gantt/editable-cell";

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

  const handleAddCalendar = () => {
    dispatch({ type: 'ADD_CALENDAR' });
  };

  const handleRemoveCalendar = (calendarId: string) => {
    if (calendarId === selectedCalendarId) {
      setSelectedCalendarId(defaultCalendarId);
    }
    dispatch({ type: 'REMOVE_CALENDAR', payload: { calendarId } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Calendar Management</DialogTitle>
        </DialogHeader>
        <div className="flex-grow flex flex-col md:flex-row gap-6 overflow-hidden">
          <div className="w-full md:w-1/4 flex flex-col gap-4 md:border-r md:pr-6">
            <h3 className="text-lg font-semibold">Calendars</h3>
             <ScrollArea className="flex-grow">
               <div className="flex flex-col gap-2 pr-4">
                  {calendars.map(calendar => (
                    <Button
                      key={calendar.id}
                      variant={calendar.id === selectedCalendarId ? "secondary" : "ghost"}
                      className="w-full justify-start h-auto py-2"
                      onClick={() => setSelectedCalendarId(calendar.id)}
                    >
                      <div className="flex flex-col items-start">
                        <span>{calendar.name}</span>
                        {calendar.id === defaultCalendarId && (
                            <span className="text-xs text-muted-foreground">(Default)</span>
                        )}
                      </div>
                    </Button>
                  ))}
               </div>
            </ScrollArea>
             <div className="mt-auto">
                <Button onClick={handleAddCalendar} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Calendar
                </Button>
            </div>
          </div>
          <div className="w-full md:w-3/4 flex-grow overflow-auto">
            {selectedCalendar ? (
              <CalendarView 
                key={selectedCalendar.id}
                calendar={selectedCalendar}
                isDefault={selectedCalendar.id === defaultCalendarId}
                dispatch={dispatch} 
                onRemove={() => handleRemoveCalendar(selectedCalendar.id)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Select a calendar to view its details.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
