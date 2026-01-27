'use client';

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { Calendar as CalendarType, Exception } from "@/lib/types";
import { EditableCell } from "@/components/omni-gantt/editable-cell";
import { Calendar } from "@/components/ui/calendar";
import { startOfDay, endOfDay, addDays, getYear, isSameDay, formatISO, eachDayOfInterval } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditableDateCell } from "../omni-gantt/editable-date-cell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

function ExceptionsEditor({ calendar, dispatch }: { calendar: CalendarType, dispatch: any }) {
    const exceptions = calendar.exceptions || [];

    const handleUpdateException = (exceptionId: string, updates: Partial<Exception>) => {
        const newExceptions = exceptions.map(ex => ex.id === exceptionId ? { ...ex, ...updates } : ex);
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, exceptions: newExceptions } });
    }

    const handleRemoveException = (exceptionId: string) => {
        const newExceptions = exceptions.filter(ex => ex.id !== exceptionId);
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, exceptions: newExceptions } });
    }

    return (
        <div className="flex flex-col h-full mt-6">
            <h3 className="font-semibold mb-2">Exceptions</h3>
            <div className="flex-grow border rounded-md">
                 <ScrollArea className="h-[250px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Active</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Start</TableHead>
                                <TableHead>Finish</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {exceptions.map(exception => (
                                <TableRow key={exception.id}>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={exception.isActive}
                                            onCheckedChange={(checked) => handleUpdateException(exception.id, { isActive: !!checked })}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <EditableCell value={exception.name} onSave={val => handleUpdateException(exception.id, { name: val })} />
                                    </TableCell>
                                    <TableCell>
                                        <EditableDateCell value={exception.start} onSave={val => val && handleUpdateException(exception.id, { start: val })} />
                                    </TableCell>
                                    <TableCell>
                                        <EditableDateCell value={exception.finish} onSave={val => val && handleUpdateException(exception.id, { finish: val })} />
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveException(exception.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </ScrollArea>
            </div>
        </div>
    )
}

function Legend() {
    return (
        <div className="p-4 border rounded-md bg-card">
            <h3 className="font-semibold mb-2 text-sm">Legend</h3>
            <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-card border rounded-sm"></div><span>Working</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-muted rounded-sm"></div><span>Non-working</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-destructive text-destructive-foreground flex items-center justify-center font-bold rounded-sm">31</div><span>Exception (Active)</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-destructive/50 text-destructive-foreground flex items-center justify-center font-bold rounded-sm">31</div><span>Exception (Inactive)</span></div>
            </div>
        </div>
    )
}

export function CalendarView({ calendar, dispatch }: { calendar: CalendarType, dispatch: any }) {
    const [year, setYear] = useState(new Date().getFullYear());

    const getDatesInRange = (exception: Exception): Date[] => {
        if (!exception.start || !exception.finish) return [];
        return eachDayOfInterval({
            start: startOfDay(exception.start),
            end: endOfDay(exception.finish)
        });
    };

    const modifiers = useMemo(() => {
        const activeExceptionDates = (calendar.exceptions || []).filter(ex => ex.isActive).flatMap(getDatesInRange);
        const inactiveExceptionDates = (calendar.exceptions || []).filter(ex => !ex.isActive).flatMap(getDatesInRange);
        const nonWorkingOverrides = new Set(calendar.nonWorkingDayOverrides || []);
        const workingOverrides = new Set(calendar.workingDayOverrides || []);
        
        return {
            working: (date: Date) => {
                const isoDate = formatISO(date, { representation: 'date' });
                const isDefaultWorking = calendar.workingDays.includes(date.getDay());
                const isWorking = (isDefaultWorking && !nonWorkingOverrides.has(isoDate)) || workingOverrides.has(isoDate);
                return isWorking && !activeExceptionDates.some(d => isSameDay(d, date));
            },
            nonworking: (date: Date) => {
                const isoDate = formatISO(date, { representation: 'date' });
                const isDefaultWorking = calendar.workingDays.includes(date.getDay());
                const isWorking = (isDefaultWorking && !nonWorkingOverrides.has(isoDate)) || workingOverrides.has(isoDate);
                return !isWorking && !activeExceptionDates.some(d => isSameDay(d, date));
            },
            active_exception: activeExceptionDates,
            inactive_exception: inactiveExceptionDates,
        };
    }, [calendar]);

    const handleDayClick = (date: Date) => {
        const isoDate = formatISO(date, { representation: 'date' });
        const exceptions = calendar.exceptions || [];
        const isNamedException = exceptions.some(ex => date >= startOfDay(ex.start) && date <= endOfDay(ex.finish));
        
        if (isNamedException) return;

        let nonWorkingOverrides = [...(calendar.nonWorkingDayOverrides || [])];
        let workingOverrides = [...(calendar.workingDayOverrides || [])];
        
        if (nonWorkingOverrides.includes(isoDate)) {
            nonWorkingOverrides = nonWorkingOverrides.filter(d => d !== isoDate);
        } else if (workingOverrides.includes(isoDate)) {
            workingOverrides = workingOverrides.filter(d => d !== isoDate);
        } else {
            if (calendar.workingDays.includes(date.getDay())) {
                nonWorkingOverrides.push(isoDate);
            } else {
                workingOverrides.push(isoDate);
            }
        }
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, nonWorkingDayOverrides, workingDayOverrides } });
    };

    const handleDayDoubleClick = (date: Date) => {
        const exceptions = [...(calendar.exceptions || [])];
        const existingIndex = exceptions.findIndex(ex => date >= startOfDay(ex.start) && date <= endOfDay(ex.finish));

        if (existingIndex > -1) {
            exceptions[existingIndex].isActive = !exceptions[existingIndex].isActive;
        } else {
            const newException: Exception = {
                id: `ex-${Date.now()}`,
                name: "New Exception",
                start: startOfDay(date),
                finish: endOfDay(date),
                isActive: true,
            };
            exceptions.push(newException);
        }
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, exceptions } });
    };

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between">
            <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft /></Button>
                <span className="text-xl font-bold">{year}</span>
                <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight /></Button>
            </div>
            <Legend />
        </div>
        
        <ScrollArea className="flex-grow mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-4">
              {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i}>
                      <Calendar
                          month={new Date(year, i, 1)}
                          modifiers={modifiers}
                          onDayClick={handleDayClick}
                          onDayDoubleClick={handleDayDoubleClick}
                          modifiersClassNames={{
                              working: "bg-card text-card-foreground hover:bg-card",
                              nonworking: "bg-muted text-muted-foreground hover:bg-muted",
                              active_exception: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                              inactive_exception: "bg-destructive/50 text-destructive-foreground hover:bg-destructive/60",
                          }}
                          className="border rounded-md p-2"
                      />
                  </div>
              ))}
          </div>
        </ScrollArea>

        <ExceptionsEditor calendar={calendar} dispatch={dispatch} />
      </div>
    );
}
