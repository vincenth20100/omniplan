'use client';
import React, { useMemo } from 'react';
import type { Link, Task } from '@/lib/types';
import { differenceInCalendarDays } from 'date-fns';

interface LineInfo {
    id: string;
    path: string;
    isDriving: boolean;
}

export const DependencyLines = React.memo(({ links, tasks, taskIndexMap, rowHeight, scale, ganttStartDate }: {
    links: Link[];
    tasks: Task[];
    taskIndexMap: Map<string, number>;
    rowHeight: number;
    scale: number;
    ganttStartDate: Date;
}) => {
    const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

    const lines: LineInfo[] = useMemo(() => {
        return links.map(link => {
            const sourceTask = taskMap.get(link.source);
            const targetTask = taskMap.get(link.target);

            if (!sourceTask || !targetTask) return null;

            const sourceIndex = taskIndexMap.get(link.source);
            const targetIndex = taskIndexMap.get(link.target);

            if (sourceIndex === undefined || targetIndex === undefined) return null;

            const sourceY = sourceIndex * rowHeight + rowHeight / 2;
            const targetY = targetIndex * rowHeight + rowHeight / 2;

            const getTaskGeometry = (task: Task) => {
                const isMilestone = task.duration === 0 && !task.isSummary;
                const offsetDays = differenceInCalendarDays(task.start, ganttStartDate);

                let left: number;
                let width: number;

                if (isMilestone) {
                    const milestoneSize = 20;
                    left = offsetDays * scale + scale / 2 - milestoneSize / 2;
                    width = milestoneSize;
                } else {
                    left = offsetDays * scale;
                    width = (differenceInCalendarDays(task.finish, task.start) + 1) * scale;
                }
                return { left, width };
            };

            const sourceGeo = getTaskGeometry(sourceTask);
            const targetGeo = getTaskGeometry(targetTask);

            let x1: number, x2: number;

            switch(link.type) {
                case 'SS':
                    x1 = sourceGeo.left;
                    x2 = targetGeo.left;
                    break;
                case 'FF':
                    x1 = sourceGeo.left + sourceGeo.width;
                    x2 = targetGeo.left + targetGeo.width;
                    break;
                case 'SF':
                    x1 = sourceGeo.left;
                    x2 = targetGeo.left + targetGeo.width;
                    break;
                case 'FS':
                default:
                    x1 = sourceGeo.left + sourceGeo.width;
                    x2 = targetGeo.left;
                    break;
            }

            const isDriving = link.isDriving || false;
            const turnRadius = 10;

            let path;
            if (x2 > x1 + 20) {
                 const midX = x2 - 20;
                 path = `M ${x1} ${sourceY} L ${midX} ${sourceY} C ${midX + turnRadius} ${sourceY}, ${midX + turnRadius} ${targetY}, ${midX} ${targetY} L ${x2} ${targetY}`;
            } else {
                 const verticalMidpoint = sourceY + (targetY - sourceY) / 2;
                 path = `M ${x1} ${sourceY} L ${x1+10} ${sourceY} L ${x1+10} ${verticalMidpoint} L ${x2-10} ${verticalMidpoint} L ${x2-10} ${targetY} L ${x2} ${targetY}`;
            }

            return { id: link.id, path, isDriving };

        }).filter((l): l is LineInfo => l !== null);
    }, [links, taskMap, taskIndexMap, rowHeight, scale, ganttStartDate]);


    return (
        <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ overflow: 'visible' }}
        >
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" />
                </marker>
                 <marker id="arrowhead-driving" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--destructive))" />
                </marker>
            </defs>
            {lines.map(line => (
                <path
                    key={line.id}
                    d={line.path}
                    stroke={line.isDriving ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'}
                    strokeWidth="1.5"
                    fill="none"
                    markerEnd={line.isDriving ? "url(#arrowhead-driving)" : "url(#arrowhead)"}
                />
            ))}
        </svg>
    );
});

DependencyLines.displayName = 'DependencyLines';
