'use client';
import React from 'react';
import type { Link, Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const BAR_HEIGHT = 28;

interface LineInfo {
    id: string;
    path: string;
    isDriving: boolean;
}

export const DependencyLines = React.memo(({ links, taskBarElements, taskIndexMap, rowHeight }: { 
    links: Link[];
    taskBarElements: Record<string, HTMLDivElement | null>;
    taskIndexMap: Map<string, number>;
    rowHeight: number;
}) => {

    const lines: LineInfo[] = links.map(link => {
        const sourceEl = taskBarElements[link.source];
        const targetEl = taskBarElements[link.target];

        if (!sourceEl || !targetEl) return null;

        const sourceIndex = taskIndexMap.get(link.source);
        const targetIndex = taskIndexMap.get(link.target);

        if (sourceIndex === undefined || targetIndex === undefined) return null;

        const sourceY = sourceIndex * rowHeight + rowHeight / 2;
        const targetY = targetIndex * rowHeight + rowHeight / 2;

        let x1: number, x2: number;
        const sourceOffsetLeft = sourceEl.offsetLeft;
        const sourceWidth = sourceEl.offsetWidth;
        const targetOffsetLeft = targetEl.offsetLeft;
        const targetWidth = targetEl.offsetWidth;

        switch(link.type) {
            case 'SS':
                x1 = sourceOffsetLeft;
                x2 = targetOffsetLeft;
                break;
            case 'FF':
                x1 = sourceOffsetLeft + sourceWidth;
                x2 = targetOffsetLeft + targetWidth;
                break;
            case 'SF':
                x1 = sourceOffsetLeft;
                x2 = targetOffsetLeft + targetWidth;
                break;
            case 'FS':
            default:
                x1 = sourceOffsetLeft + sourceWidth;
                x2 = targetOffsetLeft;
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
