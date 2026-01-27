'use client';
import { useState, useMemo } from 'react';
import type { ProjectState, Calendar, Exception } from '@/lib/types';
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
import { EditableCell } from '@/components/omni-gantt/editable-cell';
import { EditableDateCell } from '../omni-gantt/editable-date-cell';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DayPicker } from "react-day-picker";
import { format, addDays, addYears } from 'date-fns';
import { calendarService } from '@/lib/calendar';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Label } from '@/components/ui/label';

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

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isMobile = useIsMobile();

  const handlePrevYear = () => {
    setCurrentMonth(prev => addYears(prev, -1));
  };

  const handleNextYear = () => {
    setCurrentMonth(prev => addYears(prev, 1));
  };

  const handleAddCalendar = () => {
    dispatch({ type: 'ADD_CALENDAR' });
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
  
  const modifiers = useMemo(() => {
    if (!selectedCalendar) return {};
    
    const exceptionDays = (selectedCalendar.exceptions || [])
      .filter(ex => ex.isActive)
      .flatMap(ex => {
        let days = [];
        let current = ex.start;
        while(current <= ex.finish) {
          days.push(new Date(current));
          current = addDays(current, 1);
        }
        return days;
      });

    const workingOverrides = (selectedCalendar.workingDayOverrides || []).map(d => new Date(d+'T00:00:00'));
    const nonWorkingOverrides = (selectedCalendar.nonWorkingDayOverrides || []).map(d => new Date(d+'T00:00:00'));

    return {
      nonworking: (date: Date) => !calendarService.isWorkingDay(date, selectedCalendar),
      exceptions: exceptionDays,
      workingOverrides,
      nonWorkingOverrides
    };
  }, [selectedCalendar]);
  
  const modifiersClassNames = {
    nonworking: 'text-muted-foreground opacity-50',
    exceptions: 'bg-destructive/20 text-destructive-foreground',
    workingOverrides: 'font-bold text-green-600',
    nonWorkingOverrides: 'line-through text-red-600'
  };

  const handleDayClick = (day: Date) => {
      if (!selectedCalendar) return;

      const isoDate = format(day, 'yyyy-MM-dd');
      
      let workingOverrides = [...(selectedCalendar.workingDayOverrides || [])];
      let nonWorkingOverrides = [...(selectedCalendar.nonWorkingDayOverrides || [])];

      const isCurrentlyWorking = calendarService.isWorkingDay(day, selectedCalendar);
      const isDefaultWorking = selectedCalendar.workingDays.includes(day.getDay());

      if (isCurrentlyWorking) {
        // Make it non-working
        if (workingOverrides.includes(isoDate)) {
          workingOverrides = workingOverrides.filter(d => d !== isoDate);
        } else {
          nonWorkingDayOverrides.push(isoDate);
        }
      } else {
        // Make it working
        if (nonWorkingOverrides.includes(isoDate)) {
          nonWorkingOverrides = nonWorkingOverrides.filter(d => d !== isoDate);
        } else {
          workingOverrides.push(isoDate);
        }
      }

      dispatch({
          type: 'UPDATE_CALENDAR',
          payload: { 
              id: selectedCalendar.id,
              workingDayOverrides: Array.from(new Set(workingOverrides)),
              nonWorkingDayOverrides: Array.from(new Set(nonWorkingOverrides))
          }
      });
  };

  const handleWorkingDayChange = (dayIndex: number, checked: boolean) => {
      if (selectedCalendar) {
          let newWorkingDays = [...selectedCalendar.workingDays];
          if (checked) {
              if (!newWorkingDays.includes(dayIndex)) {
                  newWorkingDays.push(dayIndex);
              }
          } else {
              newWorkingDays = newWorkingDays.filter(d => d !== dayIndex);
          }
          newWorkingDays.sort();
          dispatch({
              type: 'UPDATE_CALENDAR',
              payload: { id: selectedCalendar.id, workingDays: newWorkingDays }
          });
      }
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
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
      
      <div className="border rounded-lg p-4 flex flex-col">
        {selectedCalendar && (
            <div className="mb-6">
                <h4 className="text-sm font-semibold mb-2">Default Work Week</h4>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div className="flex items-center gap-4">
                        {daysOfWeek.map((day, index) => (
                            <div key={day} className="flex items-center gap-2">
                                <Checkbox
                                    id={`day-${index}`}
                                    checked={selectedCalendar.workingDays.includes(index)}
                                    onCheckedChange={(checked) => handleWorkingDayChange(index, !!checked)}
                                />
                                <Label htmlFor={`day-${index}`}>{day}</Label>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Working hours are assumed to be standard business hours.</p>
                </div>
            </div>
        )}
        <div className="flex items-center">
          {!isMobile && (
              <Button variant="ghost" size="icon" onClick={handlePrevYear} className="self-center">
                  <ChevronsLeft className="h-5 w-5" />
              </Button>
          )}
          <DayPicker
              numberOfMonths={isMobile ? 1 : 3}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              showOutsideDays
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              onDayClick={handleDayClick}
              components={{
                  IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                  IconRight: () => <ChevronRight className="h-4 w-4" />,
              }}
          />
          {!isMobile && (
              <Button variant="ghost" size="icon" onClick={handleNextYear} className="self-center">
                  <ChevronsRight className="h-5 w-5" />
              </Button>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Exceptions</h3>
         <div className="border rounded-md">
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
         </div>
        <Button onClick={handleAddException} disabled={!selectedCalendar} className="mt-4">
          <Plus className="mr-2 h-4 w-4" /> Add Exception
        </Button>
      </div>
    </div>
  );
}
