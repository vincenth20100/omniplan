'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { Calendar as CalendarType } from "@/lib/types";
import { EditableCell } from "@/components/omni-gantt/editable-cell";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay } from 'date-fns';
import { Separator } from "@/components/ui/separator";

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
        <ToggleGroup type="multiple" variant="outline" value={calendar.workingDays.map(String)}
            onValueChange={handleValueChange} className="justify-start flex-wrap">
            {weekDays.map(day => (
                <ToggleGroupItem key={day.value} value={String(day.value)} aria-label={`Toggle ${day.label}`} className="h-8 w-8 p-0">
                    {day.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}

export function CalendarView({ calendar, isDefault, dispatch, onRemove }: { calendar: CalendarType, isDefault: boolean, dispatch: any, onRemove: () => void }) {
    const [year, setYear] = useState(new Date().getFullYear());
    
    const exceptionsAsDates = (calendar.exceptions || []).map(ex => new Date(ex));
    
    const handleExceptionSelect = (days: Date[] | undefined) => {
        const newExceptions = (days || []).map(d => format(startOfDay(d), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"));
        dispatch({
            type: 'UPDATE_CALENDAR',
            payload: { id: calendar.id, exceptions: newExceptions }
        });
    }

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">
                        <EditableCell 
                            value={calendar.name}
                            onSave={(newValue) => dispatch({ type: 'UPDATE_CALENDAR', payload: { id: calendar.id, name: newValue }})}
                        />
                    </h2>
                    {isDefault && <span className="text-sm text-muted-foreground">(Default)</span>}
                 </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onRemove}
                    disabled={isDefault}
                    title={isDefault ? "Cannot remove default calendar" : "Remove calendar"}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            
            <div>
                <h3 className="text-md font-semibold mb-2">Default Working Days</h3>
                <WorkingDaysEditor calendar={calendar} dispatch={dispatch} />
            </div>

            <Separator />

            <div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-semibold">Exceptions (Non-working Days)</h3>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="h-4 w-4"/></Button>
                        <span className="text-lg font-semibold w-24 text-center">{year}</span>
                        <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="h-4 w-4"/></Button>
                    </div>
                </div>
                <div className="border rounded-md p-2">
                    <Calendar
                        mode="multiple"
                        min={0}
                        selected={exceptionsAsDates}
                        onSelect={handleExceptionSelect}
                        numberOfMonths={12}
                        pagedNavigation
                        fromYear={year}
                        toYear={year}
                        classNames={{
                            months: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
                            caption_label: "text-lg font-bold",
                        }}
                        modifiers={{
                            working: (date) => calendar.workingDays.includes(date.getDay()),
                            weekend: (date) => !calendar.workingDays.includes(date.getDay())
                        }}
                        modifiersClassNames={{
                            working: "text-foreground",
                            weekend: "text-muted-foreground opacity-70",
                            selected: "bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground",
                        }}
                    />
                </div>
                 <p className="text-xs text-muted-foreground mt-2">
                    Select dates on the calendar to mark them as non-working days (holidays, etc.). These override the default working days. Click again to unmark.
                </p>
            </div>
        </div>
    );
}
