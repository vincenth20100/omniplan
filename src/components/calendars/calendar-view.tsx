'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { ProjectState, Calendar, Exception } from '@/lib/types';
import { EditableCell } from '@/components/omni-gantt/editable-cell';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';
import { EditableDateCell } from '../omni-gantt/editable-date-cell';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function CalendarView({
  projectState,
  dispatch,
}: {
  projectState: ProjectState;
  dispatch: any;
}) {
  const { calendars, defaultCalendarId } = projectState;
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    defaultCalendarId
  );
  const selectedCalendar =
    calendars.find((c) => c.id === selectedCalendarId) || null;

  const handleAddCalendar = () => {
    dispatch({ type: 'ADD_CALENDAR' });
  };

  const handleRemoveCalendar = (calendarId: string) => {
    dispatch({ type: 'REMOVE_CALENDAR', payload: { calendarId } });
  };

  const handleAddException = () => {
    if (selectedCalendar) {
      dispatch({
        type: 'UPDATE_CALENDAR',
        payload: {
          id: selectedCalendar.id,
          exceptions: [
            ...(selectedCalendar.exceptions || []),
            {
              id: `ex-${Date.now()}`,
              name: 'New Exception',
              start: new Date(),
              finish: new Date(),
              isActive: true,
            },
          ],
        },
      });
    }
  };

  const handleUpdateException = (
    exceptionId: string,
    updates: Partial<Exception>
  ) => {
    if (selectedCalendar) {
      const newExceptions = (selectedCalendar.exceptions || []).map((ex) =>
        ex.id === exceptionId ? { ...ex, ...updates } : ex
      );
      dispatch({
        type: 'UPDATE_CALENDAR',
        payload: { id: selectedCalendar.id, exceptions: newExceptions },
      });
    }
  };

  const handleRemoveException = (exceptionId: string) => {
    if (selectedCalendar) {
      const newExceptions = (selectedCalendar.exceptions || []).filter(
        (ex) => ex.id !== exceptionId
      );
      dispatch({
        type: 'UPDATE_CALENDAR',
        payload: { id: selectedCalendar.id, exceptions: newExceptions },
      });
    }
  };


  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-4">
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

      <div className="flex-grow">
        <ScrollArea className="h-[calc(80vh-250px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Active</TableHead>
                <TableHead>Exception Name</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Finish</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedCalendar?.exceptions?.map((exception) => (
                <TableRow key={exception.id}>
                  <TableCell>
                    <Checkbox
                        checked={exception.isActive}
                        onCheckedChange={(checked) => handleUpdateException(exception.id, { isActive: !!checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={exception.name}
                      onSave={(newValue) =>
                        handleUpdateException(exception.id, { name: newValue })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <EditableDateCell
                        value={exception.start}
                        onSave={(newValue) => newValue && handleUpdateException(exception.id, { start: newValue })}
                        calendar={null}
                    />
                  </TableCell>
                  <TableCell>
                     <EditableDateCell
                        value={exception.finish}
                        onSave={(newValue) => newValue && handleUpdateException(exception.id, { finish: newValue })}
                        calendar={null}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveException(exception.id)}
                    >
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
        <Button onClick={handleAddException} disabled={!selectedCalendar}>
          <Plus className="mr-2 h-4 w-4" /> Add Exception
        </Button>
      </div>
    </div>
  );
}
