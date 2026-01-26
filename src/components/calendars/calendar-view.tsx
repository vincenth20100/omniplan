'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Calendar as CalendarType, Exception } from "@/lib/types";
import { EditableCell } from "@/components/omni-gantt/editable-cell";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "@/components/ui/calendar";
import { startOfDay, addDays } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditableDateCell } from "../omni-gantt/editable-date-cell";
import { ScrollArea } from "@/components/ui/scroll-area";

const weekDays = [
    { label: 'S', value: 0 }, { label: 'M', value: 1 }, { label: 'T', value: 2 },
    { label: 'W', value: 3 }, { label: 'T', value: 4 }, { label: 'F', value: 5 }, { label: 'S', value: 6 },
];

function WorkingDaysEditor({ calendar, dispatch }: { calendar: CalendarType, dispatch: any }) {
    const handleValueChange = (newWorkingDays: string[]) => {
        dispatch({
            type: 'UPDATE_CALENDAR',
            payload: { id: calendar.id, workingDays: newWorkingDays.map(d => parseInt(d, 10)) }
        });
    };
    return (
        <div className="p-1">
            <h3 className="font-semibold mb-2 text-sm">Set default working days:</h3>
            <ToggleGroup type="multiple" variant="outline" value={calendar.workingDays.map(String)}
                onValueChange={handleValueChange} className="justify-start flex-wrap">
                {weekDays.map(day => (
                    <ToggleGroupItem key={day.value} value={String(day.value)} aria-label={`Toggle ${day.label}`} className="h-8 w-8 p-0">
                        {day.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    );
}

function ExceptionsEditor({ calendar, dispatch }: { calendar: CalendarType, dispatch: any }) {
    const exceptions = calendar.exceptions || [];

    const handleUpdateException = (exceptionId: string, updates: Partial<Exception>) => {
        const newExceptions = exceptions.map(ex => ex.id === exceptionId ? { ...ex, ...updates } : ex);
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, exceptions: newExceptions } });
    }

    const handleAddException = () => {
        const newException: Exception = {
            id: `ex-${Date.now()}`,
            name: "New Exception",
            start: new Date(),
            finish: new Date()
        };
        const newExceptions = [...exceptions, newException];
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, exceptions: newExceptions } });
    }

    const handleRemoveException = (exceptionId: string) => {
        const newExceptions = exceptions.filter(ex => ex.id !== exceptionId);
        dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, exceptions: newExceptions } });
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow border rounded-md">
                 <ScrollArea className="h-[250px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Start</TableHead>
                                <TableHead>Finish</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {exceptions.map(exception => (
                                <TableRow key={exception.id}>
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
             <div className="mt-4">
                <Button onClick={handleAddException}>Add Exception</Button>
            </div>
        </div>
    )
}

function Legend() {
    return (
        <div className="p-4 border rounded-md bg-card">
            <h3 className="font-semibold mb-2 text-sm">Legend</h3>
            <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-background border-2 rounded-sm"></div><span>Working</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-muted rounded-sm"></div><span>Nonworking</span></div>
                <div className="flex items-center gap-2"><div className="w-5 h-5 bg-destructive text-destructive-foreground flex items-center justify-center font-bold rounded-sm">31</div><span>Exception</span></div>
            </div>
        </div>
    )
}


export function CalendarView({ calendar, dispatch }: { calendar: CalendarType, isDefault: boolean, dispatch: any }) {
    const [month, setMonth] = useState(new Date());
    
    const exceptionDates = (calendar.exceptions || []).flatMap(ex => {
        let dates: Date[] = [];
        let current = startOfDay(ex.start);
        const finish = startOfDay(ex.finish);
        while(current <= finish) {
            dates.push(current);
            current = addDays(current, 1);
        }
        return dates;
    });

    const isExceptionDay = (date: Date) => exceptionDates.some(d => d.getTime() === date.getTime());

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-2 flex flex-col gap-4">
                 <Tabs defaultValue="exceptions" className="flex-grow flex flex-col">
                    <TabsList className="w-full justify-start rounded-none bg-transparent border-b p-0">
                        <TabsTrigger value="exceptions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Exceptions</TabsTrigger>
                        <TabsTrigger value="work-weeks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">Work Weeks</TabsTrigger>
                    </TabsList>
                    <TabsContent value="exceptions" className="flex-grow mt-4">
                        <ExceptionsEditor calendar={calendar} dispatch={dispatch} />
                    </TabsContent>
                    <TabsContent value="work-weeks" className="mt-4">
                        <WorkingDaysEditor calendar={calendar} dispatch={dispatch} />
                    </TabsContent>
                </Tabs>
            </div>
             <div className="flex flex-col gap-4">
                <Legend />
                <div className="border rounded-md">
                    <Calendar
                        month={month}
                        onMonthChange={setMonth}
                        modifiers={{
                            working: date => calendar.workingDays.includes(date.getDay()) && !isExceptionDay(date),
                            nonworking: date => !calendar.workingDays.includes(date.getDay()) && !isExceptionDay(date),
                            exception: date => isExceptionDay(date),
                        }}
                        modifiersClassNames={{
                            working: "text-foreground",
                            nonworking: "text-muted-foreground opacity-50",
                            exception: "bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground",
                        }}
                    />
                </div>
                <div className="text-sm text-muted-foreground">
                    <p className="font-semibold">Based on:</p>
                    <p>Default work week on calendar '{calendar.name}'</p>
                </div>
            </div>
        </div>
    );
}
