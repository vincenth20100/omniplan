'use client';
import React, { useRef, useEffect } from 'react';
import { differenceInCalendarDays, addDays, format } from 'date-fns';
import type { Task, UiDensity, Calendar, TaskLabelSetting, ColumnSpec, Resource, Assignment } from '@/lib/types';
import { cn, getProjectColor } from '@/lib/utils';
import { calendarService } from '@/lib/calendar';
import { Flame } from 'lucide-react';
import { DENSITY_SETTINGS } from '@/lib/settings';
import { TaskTooltip } from './task-tooltip';

type DragMode = 'move' | 'resize-end' | null;

export const TaskBar = React.memo(({ task, ganttStartDate, scale, dispatch, row, isSelected, onSelect, registerBarElement, uiDensity, showProgress, showTaskLabels, taskLabels, highlightCriticalPath, defaultCalendar, dateFormat, projectColors = {}, projectTextColors = {}, projectCriticalPathColors = {}, tooltipFields = [], columns, resources, assignments }: {
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
    taskLabels?: TaskLabelSetting[];
    highlightCriticalPath: boolean;
    defaultCalendar: Calendar | null;
    dateFormat: string;
    projectColors?: Record<string, string>;
    projectTextColors?: Record<string, string>;
    projectCriticalPathColors?: Record<string, string>;
    tooltipFields?: string[];
    columns?: ColumnSpec[];
    resources?: Resource[];
    assignments?: Assignment[];
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
        if (!dragStartInfo.current || !defaultCalendar) {
            if (!defaultCalendar) console.error("Cannot move task: no default calendar available.");
            return;
        }

        const dx = clientX - dragStartInfo.current.startX;
        const dayDelta = Math.round(dx / scale);

        if (dragStartInfo.current.mode === 'move') {
            const newStart = calendarService.addWorkingDays(dragStartInfo.current.originalStart, dayDelta, defaultCalendar);
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
            <TaskTooltip task={task} tooltipFields={tooltipFields} dateFormat={dateFormat} columns={columns} resources={resources} assignments={assignments}>
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
            >
                <svg width={milestoneSize} height={milestoneSize} viewBox="0 0 24 24" className={cn(
                    "drop-shadow-md",
                     task.isCritical && highlightCriticalPath ? 'fill-milestone-critical' : 'fill-milestone-default',
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
            </TaskTooltip>
        );
    }


    const offsetDays = differenceInCalendarDays(task.start, ganttStartDate);
    const left = offsetDays * scale;
    const width = (differenceInCalendarDays(task.finish, task.start) + 1) * scale;
    const top = row * rowHeight + (rowHeight - (isSummary ? summaryBarHeight : barHeight)) / 2;

    const getCriticalStyle = () => {
        if (!task.isCritical || !highlightCriticalPath || !task.criticalFor || task.criticalFor.length === 0) return {};

        const resolveColor = (id: string) => (projectCriticalPathColors && projectCriticalPathColors[id]) ? projectCriticalPathColors[id] : ((projectColors && projectColors[id]) ? projectColors[id] : getProjectColor(id));

        if (task.criticalFor.length === 1) {
            const color = resolveColor(task.criticalFor[0]);
            return isSummary ? { borderColor: color } : { backgroundColor: color };
        }

        const colors = task.criticalFor.map(id => resolveColor(id));
        const gradientStops = colors.map((c, i) => {
            const step = 100 / colors.length;
            return `${c} ${i * step}%, ${c} ${(i + 1) * step}%`;
        }).join(', ');

        return isSummary ? { borderImage: `linear-gradient(to right, ${gradientStops}) 1` } : { background: `linear-gradient(135deg, ${gradientStops})` };
    };

    const customStyle = getCriticalStyle();
    const customTextStyle = (showTaskLabels && !isSummary && task.projectId && projectTextColors && projectTextColors[task.projectId]) ? { color: projectTextColors[task.projectId] } : {};

    return (
        <TaskTooltip task={task} tooltipFields={tooltipFields} dateFormat={dateFormat} columns={columns} resources={resources} assignments={assignments}>
        <div
            ref={barRef}
            className={cn(
                "absolute flex items-center group transition-all duration-200",
                !isSummary && "cursor-pointer",
                isSelected ? "ring-2 ring-offset-2 ring-accent ring-offset-card" : "hover:ring-1 hover:ring-accent",
                isSummary ? 
                    (task.isCritical && highlightCriticalPath ? "bg-destructive/15 border-2 border-gantt-bar-critical rounded-sm" : "bg-muted border-2 border-gantt-bar-default rounded-sm")
                    : (task.isCritical && highlightCriticalPath ? "bg-gantt-bar-critical/90 rounded-md" : (task.schedulingConflict ? "bg-destructive/70 rounded-md" : "bg-gantt-bar-default/80 rounded-md"))
            )}
            style={{
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${isSummary ? summaryBarHeight : barHeight}px`,
                ...customStyle
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
            onTouchStart={(e) => handleTouchStart(e, 'move')}
            onClick={onSelect}
        >
            {!isSummary && showProgress && ( 
                <div 
                    className={cn(
                        "absolute top-0 left-0 h-full rounded-l-md",
                        task.isCritical && highlightCriticalPath ? "bg-gantt-bar-critical" : "bg-gantt-bar-default"
                    )}
                    style={{ width: `${task.percentComplete}%`, ...(customStyle.background || customStyle.backgroundColor ? { filter: 'brightness(0.8)', background: customStyle.background || customStyle.backgroundColor } : {}) }}
                />
            )}
             {(!taskLabels || taskLabels.length === 0) ? (
                 <div className={cn(
                    "relative px-2 text-sm truncate w-full flex justify-between items-center",
                    isSummary ? "text-card-foreground font-medium" : (!customTextStyle.color ? "text-primary-foreground" : ""),
                    !showTaskLabels && "text-transparent"
                )} style={customTextStyle}>
                    <span>{task.name}</span>
                    {!isSummary && task.schedulingConflict && <Flame className="h-4 w-4 text-destructive-foreground flex-shrink-0" />}
                </div>
             ) : showTaskLabels && (
                <>
                 {taskLabels.map((labelSetting, index) => {
                     let content = '';
                     switch(labelSetting.field) {
                         case 'name': content = task.name; break;
                         case 'start': content = format(task.start, dateFormat); break;
                         case 'finish': content = format(task.finish, dateFormat); break;
                         case 'duration': content = `${task.duration} ${task.durationUnit || 'd'}`; break;
                         case 'percentComplete': content = `${task.percentComplete}%`; break;
                         default: content = (task as any)[labelSetting.field] || '';
                     }

                     const positionClasses = {
                         inside: "left-0 top-0 w-full h-full flex items-center px-2 overflow-visible",
                         left: "right-full top-1/2 -translate-y-1/2 mr-2 justify-end",
                         right: "left-full top-1/2 -translate-y-1/2 ml-2 justify-start",
                         top: "bottom-full left-1/2 -translate-x-1/2 mb-1 justify-center",
                         bottom: "top-full left-1/2 -translate-x-1/2 mt-1 justify-center"
                     };

                     const isInside = labelSetting.location === 'inside';
                     const finalTextColorClass = isInside
                        ? (isSummary ? "text-card-foreground font-medium" : (!customTextStyle.color ? "text-primary-foreground" : ""))
                        : (isSummary ? "text-foreground font-medium" : "text-foreground");

                     return (
                         <div
                            key={index}
                            className={cn(
                                "absolute text-xs whitespace-nowrap pointer-events-none flex z-20 drop-shadow-md",
                                positionClasses[labelSetting.location],
                                finalTextColorClass,
                            )}
                            style={isInside ? customTextStyle : {}}
                         >
                            {content}
                            {isInside && !isSummary && task.schedulingConflict && <Flame className="h-4 w-4 text-destructive-foreground flex-shrink-0 ml-2" />}
                         </div>
                     );
                 })}
                </>
             )}
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
                    task.isCritical && highlightCriticalPath ? "border-t-[7px] border-t-gantt-bar-critical" : "border-t-[7px] border-t-gantt-bar-default"
                )} style={customStyle.borderColor ? { borderTopColor: customStyle.borderColor } : (task.criticalFor && task.criticalFor.length > 0 ? { borderTopColor: ((projectCriticalPathColors && projectCriticalPathColors[task.criticalFor[0]]) || (projectColors && projectColors[task.criticalFor[0]]) || getProjectColor(task.criticalFor[0])) } : {})}></div>
                <div className={cn(
                    "absolute -right-[1px] -bottom-[5px] w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent",
                    task.isCritical && highlightCriticalPath ? "border-t-[7px] border-t-gantt-bar-critical" : "border-t-[7px] border-t-gantt-bar-default"
                )} style={customStyle.borderColor ? { borderTopColor: customStyle.borderColor } : (task.criticalFor && task.criticalFor.length > 0 ? { borderTopColor: ((projectCriticalPathColors && projectCriticalPathColors[task.criticalFor[0]]) || (projectColors && projectColors[task.criticalFor[0]]) || getProjectColor(task.criticalFor[0])) } : {})}></div>
            </>
        )}
        </div>
        </TaskTooltip>
    );
});

TaskBar.displayName = 'TaskBar';
