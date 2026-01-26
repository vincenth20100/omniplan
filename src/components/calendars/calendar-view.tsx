'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ProjectState, Calendar } from "@/lib/types";
import { EditableCell } from "@/components/omni-gantt/editable-cell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const weekDays = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
];

function WorkingDaysEditor({ calendar, dispatch }: { calendar: Calendar, dispatch: any }) {
    
    const handleValueChange = (newWorkingDays: string[]) => {
        dispatch({
            type: 'UPDATE_CALENDAR',
            payload: {
                id: calendar.id,
                workingDays: newWorkingDays.map(d => parseInt(d, 10))
            }
        });
    };

    return (
        <ToggleGroup 
            type="multiple" 
            variant="outline"
            value={calendar.workingDays.map(String)}
            onValueChange={handleValueChange}
            className="justify-start"
        >
            {weekDays.map(day => (
                <ToggleGroupItem 
                    key={day.value} 
                    value={String(day.value)} 
                    aria-label={`Toggle ${day.label}`}
                    className="h-8 w-8 p-0"
                >
                    {day.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}

export function CalendarView({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const { calendars, defaultCalendarId } = projectState;

    const handleAddCalendar = () => {
        dispatch({ type: 'ADD_CALENDAR' });
    };

    const handleRemoveCalendar = (calendarId: string) => {
        dispatch({ type: 'REMOVE_CALENDAR', payload: { calendarId } });
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow">
                <ScrollArea className="h-[calc(80vh-150px)]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Working Days</TableHead>
                                <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calendars.map(calendar => (
                                <TableRow key={calendar.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <EditableCell 
                                                value={calendar.name}
                                                onSave={(newValue) => dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, name: newValue }})}
                                            />
                                            {calendar.id === defaultCalendarId && (
                                                <span className="text-xs text-muted-foreground">(Default)</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <WorkingDaysEditor calendar={calendar} dispatch={dispatch} />
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleRemoveCalendar(calendar.id)}
                                            disabled={calendar.id === defaultCalendarId}
                                            title={calendar.id === defaultCalendarId ? "Cannot remove default calendar" : "Remove calendar"}
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
                <Button onClick={handleAddCalendar}>
                    <Plus className="mr-2 h-4 w-4" /> Add Calendar
                </Button>
            </div>
        </div>
    );
}
