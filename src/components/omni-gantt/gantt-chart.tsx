'use client';
import type { ProjectState } from '@/lib/types';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TaskTable } from './task-table';
import { Timeline } from './timeline';
import React, { useRef, useCallback } from 'react';

export function GanttChart({ projectState, dispatch }: { projectState: ProjectState, dispatch: any }) {
    const tableViewportRef = useRef<HTMLDivElement>(null);
    const timelineViewportRef = useRef<HTMLDivElement>(null);
    const isSyncingVerticalScroll = useRef(false);

    const handleVerticalScroll = useCallback((scroller: 'table' | 'timeline') => {
        if (isSyncingVerticalScroll.current) {
            isSyncingVerticalScroll.current = false;
            return;
        }

        isSyncingVerticalScroll.current = true;
        if (scroller === 'table' && tableViewportRef.current && timelineViewportRef.current) {
            timelineViewportRef.current.scrollTop = tableViewportRef.current.scrollTop;
        } else if (scroller === 'timeline' && tableViewportRef.current && timelineViewportRef.current) {
            tableViewportRef.current.scrollTop = timelineViewportRef.current.scrollTop;
        }
    }, []);
    
    return (
        <div className="border rounded-lg overflow-hidden h-full flex flex-col bg-card">
            <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={40} minSize={20}>
                    <TaskTable 
                        tasks={projectState.tasks} 
                        selectedTaskIds={projectState.selectedTaskIds} 
                        dispatch={dispatch} 
                        visibleColumns={projectState.visibleColumns}
                        columns={projectState.columns}
                        viewportRef={tableViewportRef}
                        onScroll={() => handleVerticalScroll('table')}
                    />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={60}>
                    <Timeline 
                        tasks={projectState.tasks} 
                        links={projectState.links}
                        dispatch={dispatch}
                        selectedTaskIds={projectState.selectedTaskIds}
                        viewportRef={timelineViewportRef}
                        onScroll={() => handleVerticalScroll('timeline')}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
