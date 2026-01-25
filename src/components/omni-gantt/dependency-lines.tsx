'use client';
import React from 'react';
import type { Link, Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 48; // Corresponds to h-12 in tailwind
const BAR_HEIGHT = 28;

interface LineInfo {
    id: string;
    path: string;
    isDriving: boolean;
}

export const DependencyLines = React.memo(({ tasks, links, taskBarElements }: { 
    tasks: Task[];
    links: Link[];
    taskBarElements: Record<string, HTMLDivElement | null>;
}) => {
    const taskIndexMap = new Map(tasks.map((t, i) => [t.id, i]));

    const lines: LineInfo[] = links.map(link => {
        const sourceEl = taskBarElements[link.source];
        const targetEl = taskBarElements[link.target];

        if (!sourceEl || !targetEl) return null;

        const sourceIndex = taskIndexMap.get(link.source);
        const targetIndex = taskIndexMap.get(link.target);

        if (sourceIndex === undefined || targetIndex === undefined) return null;

        const sourceY = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const targetY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        let x1, x2, y1, y2, isDriving;

        y1 = sourceY;
        y2 = targetY;

        const turnRadius = 10;
        const arrowSize = 5;

        // FS link
        x1 = sourceEl.offsetLeft + sourceEl.offsetWidth;
        x2 = targetEl.offsetLeft;
        isDriving = link.isDriving || false;
        
        const midX = x2 - 20;

        let path;
        if (x2 > x1 + 20) {
             path = `M ${x1} ${y1} L ${midX} ${y1} C ${midX + turnRadius} ${y1}, ${midX + turnRadius} ${y2}, ${midX} ${y2} L ${x2} ${y2}`;
        } else {
             path = `M ${x1} ${y1} L ${x1+10} ${y1} L ${x1+10} ${y1 + ROW_HEIGHT/2} L ${x2-10} ${y1 + ROW_HEIGHT/2} L ${x2-10} ${y2} L ${x2} ${y2}`;
        }


        return { id: link.id, path, isDriving };

    }).filter((l): l is LineInfo => l !== null);


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
