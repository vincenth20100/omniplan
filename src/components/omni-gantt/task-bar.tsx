'use client';
import React, { useRef, useEffect } from 'react';
import { differenceInCalendarDays, addDays, format } from 'date-fns';
import type { Task, UiDensity } from '@/lib/types';
import { cn } from '@/lib/utils';
import { calendarService } from '@/lib/calendar';
import { Flame } from 'lucide-react';
import { DENSITY_SETTINGS } from '@/lib/settings';

type DragMode = 'move' | 'resize-end' | null;

export const TaskBar = React.memo(({ task, ganttStartDate, scale, dispatch, row, isSelected, onSelect, registerBarElement, uiDensity, showProgress, showTaskLabels, highlightCriticalPath }: {
    task: Task;
    ganttStartDate: Date;
    scale: number;
    dispatch: any;
    row: number;
    isSelected: boolean;
    onSelect: (event: React.MouseEvent) => void;
    registerBarElement: (taskId: string, element: HTMLDivElement | null) => void;
    uiDensity: UiDensity;
    showProgress: boolean;
    showTaskLabels: boolean;
    highlightCriticalPath: boolean;
}) => {
    const barRef = useRef<HTMLDivElement>(null);
    const dragStartInfo = useRef<{
        startX: number;
        originalStart: Date;
        originalDuration: number;
        mode: DragMode;
    } | null>(null);

    const isSummary = task.isSummary;
    const { rowHeight, barHeight, summaryBarHeight } = DENSITY_SETTINGS[uiDensity];

    useEffect(() => {
        registerBarElement(task.id, barRef.current);
        return () => registerBarElement(task.id, null);
    }, [task.id, registerBarElement]);
    
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

    // Milestone rendering
    if (task.duration === 0 && !isSummary) {
        const offsetDays = differenceInCalendarDays(task.start, ganttStartDate);
        const milestoneSize = 20;
        const left = offsetDays * scale + scale / 2 - milestoneSize / 2;
        const top = row * rowHeight + (rowHeight - milestoneSize) / 2;

        return (
            <div
                ref={barRef}
                className={cn("absolute flex items-center justify-center cursor-pointer", isSelected ? "z-10" : "")}
                style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    width: `${milestoneSize}px`,
                    height: `${milestoneSize}px`,
                }}
                onClick={onSelect}
                title={`${task.name}\n${format(task.start, 'MMM d, yyyy')}`}
            >
                <svg width={milestoneSize} height={milestoneSize} viewBox="0 0 24 24" className={cn(
                    "drop-shadow-md",
                    task.isCritical && highlightCriticalPath ? "fill-destructive" : "fill-primary",
                )}>
                    <path d="M12 2L2 12L12 22L22 12L12 2Z"
                        stroke={isSelected ? 'hsl(var(--accent))' : 'hsl(var(--card))'}
                        strokeWidth="2"
                    />
                </svg>
                 {showTaskLabels && (
                    <span className="absolute text-xs whitespace-nowrap pl-2" style={{ left: `${milestoneSize}px`}}>
                        {task.name}
                    </span>
                )}
            </div>
        );
    }


    const offsetDays = differenceInCalendarDays(task.start, ganttStartDate);
    const left = offsetDays * scale;
    const width = (differenceInCalendarDays(task.finish, task.start) + 1) * scale;
    const top = row * rowHeight + (rowHeight - (isSummary ? summaryBarHeight : barHeight)) / 2;

    return (
        <div
            ref={barRef}
            className={cn(
                "absolute flex items-center group transition-all duration-200",
                !isSummary && "cursor-pointer",
                isSelected ? "ring-2 ring-offset-2 ring-accent ring-offset-card" : "hover:ring-1 hover:ring-accent",
                isSummary ? 
                    (task.isCritical && highlightCriticalPath ? "bg-destructive/15 border-2 border-destructive/90 rounded-sm" : "bg-card border-2 border-primary/90 rounded-sm")
                    : (task.isCritical && highlightCriticalPath ? "bg-destructive/90 rounded-md" : (task.schedulingConflict ? "bg-destructive/70 rounded-md" : "bg-primary/80 rounded-md"))
            )}
            style={{
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${isSummary ? summaryBarHeight : barHeight}px`
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
            onTouchStart={(e) => handleTouchStart(e, 'move')}
            onClick={onSelect}
        >
            {!isSummary && showProgress && ( 
                <div 
                    className={cn(
                        "absolute top-0 left-0 h-full rounded-l-md",
                        task.isCritical && highlightCriticalPath ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${task.percentComplete}%`}}
                />
            )}
             <div className={cn(
                "relative px-2 text-sm truncate w-full flex justify-between items-center",
                isSummary ? (task.isCritical && highlightCriticalPath ? "text-destructive font-medium" : "text-primary font-medium") : "text-primary-foreground",
                !showTaskLabels && "text-transparent"
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
                <div className={cn(
                    "absolute -left-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent",
                    task.isCritical && highlightCriticalPath ? "border-t-[7px] border-t-destructive/90" : "border-t-[7px] border-t-primary/90"
                )}></div>
                <div className={cn(
                    "absolute -right-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent",
                    task.isCritical && highlightCriticalPath ? "border-t-[7px] border-t-destructive/90" : "border-t-[7px] border-t-primary/90"
                )}></div>
            </>
        )}
        </div>
    );
});

TaskBar.displayName = 'TaskBar';
