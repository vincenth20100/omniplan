'use client';

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Calendar as CalendarType, Exception } from "@/lib/types";
import { EditableCell } from "@/components/omni-gantt/editable-cell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditableDateCell } from "../omni-gantt/editable-date-cell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

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
        <div className="flex flex-col h-full mt-2">
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
                                        <EditableDateCell value={exception.start} onSave={val => val && handleUpdateException(exception.id, { start: val })} calendar={null} />
                                    </TableCell>
                                    <TableCell>
                                        <EditableDateCell value={exception.finish} onSave={val => val && handleUpdateException(exception.id, { finish: val })} calendar={null} />
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

function WorkWeekEditor({ calendar, dispatch }: { calendar: CalendarType, dispatch: any }) {
    const days = [
        { label: 'Sunday', value: 0 },
        { label: 'Monday', value: 1 },
        { label: 'Tuesday', value: 2 },
        { label: 'Wednesday', value: 3 },
        { label: 'Thursday', value: 4 },
        { label: 'Friday', value: 5 },
        { label: 'Saturday', value: 6 },
    ];

    const handleWorkingDayToggle = (dayValue: number, checked: boolean) => {
        let newWorkingDays: number[];
        if (checked) {
            newWorkingDays = [...calendar.workingDays, dayValue].sort((a, b) => a - b);
        } else {
            newWorkingDays = calendar.workingDays.filter(d => d !== dayValue);
        }
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, workingDays: newWorkingDays }});
    };
    
    return (
        <div className="border rounded-md mt-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-1/3">Name</TableHead>
                        <TableHead>Working Times</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell className="font-semibold">[Default]</TableCell>
                        <TableCell className="text-muted-foreground text-xs">Times are for display only</TableCell>
                    </TableRow>
                    {days.map(day => {
                        const isWorking = calendar.workingDays.includes(day.value);
                        return (
                            <TableRow key={day.value}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`day-${day.value}`}
                                            checked={isWorking}
                                            onCheckedChange={(checked) => handleWorkingDayToggle(day.value, !!checked)}
                                        />
                                        <Label htmlFor={`day-${day.value}`}>{day.label}</Label>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {isWorking ? (
                                        <div className="flex items-center gap-4 text-sm">
                                            <span>8:00 AM - 12:00 PM</span>
                                            <span className="text-muted-foreground">|</span>
                                            <span>1:00 PM - 5:00 PM</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">Nonworking day</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

export function CalendarView({ calendar, dispatch }: { calendar: CalendarType, dispatch: any }) {
  return (
    <div className="flex flex-col h-full">
        <Tabs defaultValue="work-weeks" className="w-full">
            <TabsList>
                <TabsTrigger value="work-weeks">Work Weeks</TabsTrigger>
                <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
            </TabsList>
            <TabsContent value="work-weeks">
                <WorkWeekEditor calendar={calendar} dispatch={dispatch} />
            </TabsContent>
            <TabsContent value="exceptions">
                <ExceptionsEditor calendar={calendar} dispatch={dispatch} />
            </TabsContent>
        </Tabs>
    </div>
  );
}
