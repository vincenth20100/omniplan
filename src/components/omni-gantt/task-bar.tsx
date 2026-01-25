'use client';
import React, { useRef, useEffect } from 'react';
import { differenceInDays, addDays } from 'date-fns';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { calendarService } from '@/lib/calendar';
import { Flame } from 'lucide-react';

const ROW_HEIGHT = 48; // Corresponds to h-12 in tailwind
const BAR_HEIGHT = 28;
const SUMMARY_BAR_HEIGHT = 14;

type DragMode = 'move' | 'resize-end' | null;

export const TaskBar = React.memo(({ task, ganttStartDate, scale, dispatch, row, isSelected, onSelect, registerBarElement }: {
    task: Task;
    ganttStartDate: Date;
    scale: number;
    dispatch: any;
    row: number;
    isSelected: boolean;
    onSelect: (event: React.MouseEvent) => void;
    registerBarElement: (taskId: string, element: HTMLDivElement | null) => void;
}) => {
    const barRef = useRef<HTMLDivElement>(null);
    const isSummary = task.isSummary;

    useEffect(() => {
        registerBarElement(task.id, barRef.current);
        return () => registerBarElement(task.id, null);
    }, [task.id, registerBarElement]);

    const offsetDays = differenceInDays(task.start, ganttStartDate);
    const left = offsetDays * scale;
    const width = task.duration * scale;
    const top = row * ROW_HEIGHT + (ROW_HEIGHT - (isSummary ? SUMMARY_BAR_HEIGHT : BAR_HEIGHT)) / 2;

    const dragStartInfo = useRef<{
        startX: number;
        originalStart: Date;
        originalDuration: number;
        mode: DragMode;
    } | null>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, mode: DragMode) => {
        if (isSummary || !mode) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect(e);

        dragStartInfo.current = {
            startX: e.clientX,
            originalStart: task.start,
            originalDuration: task.duration,
            mode: mode,
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, mode: DragMode) => {
        if (isSummary || !mode) return;
        e.stopPropagation();
        
        // Select the task for touch, assuming no multi-select modifiers
        dispatch({ type: 'SELECT_TASK', payload: { taskId: task.id, ctrlKey: false, shiftKey: false } });

        dragStartInfo.current = {
            startX: e.touches[0].clientX,
            originalStart: task.start,
            originalDuration: task.duration,
            mode: mode,
        };
        
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    };

    const handleDragMove = (clientX: number) => {
        if (!dragStartInfo.current) return;
        const dx = clientX - dragStartInfo.current.startX;
        const dayDelta = Math.round(dx / scale);

        if (dragStartInfo.current.mode === 'move') {
            const newStart = calendarService.addWorkingDays(dragStartInfo.current.originalStart, dayDelta);
            dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, start: newStart } });
        } else if (dragStartInfo.current.mode === 'resize-end') {
            const newDuration = Math.max(1, dragStartInfo.current.originalDuration + dayDelta);
            if (newDuration !== task.duration) {
                dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, duration: newDuration } });
            }
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        handleDragMove(e.clientX);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        handleDragMove(e.touches[0].clientX);
    };

    const handleMouseUp = () => {
        dragStartInfo.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
    
    const handleTouchEnd = () => {
        dragStartInfo.current = null;
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
    };

    return (
        <div
            ref={barRef}
            className={cn(
                "absolute flex items-center group transition-all duration-200",
                !isSummary && "cursor-pointer",
                isSelected ? "ring-2 ring-offset-2 ring-accent ring-offset-card" : "hover:ring-1 hover:ring-accent",
                isSummary ? "bg-card border-2 border-primary/90 rounded-sm" : 
                    (task.schedulingConflict ? "bg-destructive/70 rounded-md" : "bg-primary/80 rounded-md")
            )}
            style={{
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${isSummary ? SUMMARY_BAR_HEIGHT : BAR_HEIGHT}px`
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
            onTouchStart={(e) => handleTouchStart(e, 'move')}
            onClick={onSelect}
        >
            {!isSummary && ( 
                <div 
                    className="absolute top-0 left-0 h-full bg-primary rounded-l-md"
                    style={{ width: `${task.percentComplete}%`}}
                />
            )}
             <div className={cn(
                "relative px-2 text-sm truncate w-full flex justify-between items-center",
                isSummary ? "text-primary font-medium" : "text-primary-foreground"
            )}>
                <span>{task.name}</span>
                {!isSummary && task.schedulingConflict && <Flame className="h-4 w-4 text-destructive-foreground flex-shrink-0" />}
            </div>
            {!isSummary && (
                <div 
                    className="absolute right-0 top-0 w-2 h-full cursor-ew-resize"
                    onMouseDown={(e) => handleMouseDown(e, 'resize-end')}
                    onTouchStart={(e) => handleTouchStart(e, 'resize-end')}
                />
            )}
            {isSummary && (
            <>
                <div className="absolute -left-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-t-[7px] border-t-primary/90 border-r-[7px] border-r-transparent"></div>
                <div className="absolute -right-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-t-[7px] border-t-primary/90 border-r-[7px] border-r-transparent"></div>
            </>
        )}
        </div>
    );
});

TaskBar.displayName = 'TaskBar';
