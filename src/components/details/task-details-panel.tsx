'use client';
import { useState } from 'react';
import type { Task, UiDensity, Calendar, ProjectState } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { User } from 'firebase/auth';
import { X, Columns, Columns3, RectangleHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import { TaskLinksPanel } from './task-links-panel';
import { TaskResourcesPanel } from './task-resources-panel';
import { TaskDatesPanel } from './task-dates-panel';
import { TaskActivityLogPanel } from './task-activity-log-panel';
import { TaskResourceTablePanel } from './task-resource-table-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function TaskDetailsPanel({ task, projectState, dispatch, onClose, uiDensity, defaultCalendar, dateFormat, layoutMode = 'responsive', user }: { task: Task, projectState: ProjectState, dispatch: any, onClose: () => void, uiDensity: UiDensity, defaultCalendar: Calendar | null, dateFormat: string, layoutMode?: 'responsive' | 'vertical', user: User }) {
    const isMobile = useIsMobile();
    const [layout, setLayout] = useState<'single' | 'split-2' | 'split-3'>('single');
    const [panelContents, setPanelContents] = useState<string[]>(['links', 'resources', 'dates']);

    const renderPanelContent = (type: string) => {
        switch (type) {
            case 'links': return <TaskLinksPanel task={task} projectState={projectState} dispatch={dispatch} uiDensity={uiDensity} dateFormat={dateFormat} layoutMode={layoutMode} />;
            case 'resources': return <TaskResourcesPanel task={task} projectState={projectState} dispatch={dispatch} uiDensity={uiDensity} />;
            case 'dates': return <TaskDatesPanel task={task} dispatch={dispatch} uiDensity={uiDensity} defaultCalendar={defaultCalendar} dateFormat={dateFormat} />;
            case 'notes': return <TaskActivityLogPanel task={task} dispatch={dispatch} uiDensity={uiDensity} user={user} />;
            case 'resource-table': return <TaskResourceTablePanel projectState={projectState} uiDensity={uiDensity} />;
            default: return null;
        }
    };

    const handlePanelContentChange = (index: number, value: string) => {
        const newContents = [...panelContents];
        newContents[index] = value;
        setPanelContents(newContents);
    };

    const PanelHeader = ({ index }: { index: number }) => (
        <div className="flex items-center justify-between border-b p-2 bg-muted/20 shrink-0 h-10">
            <Select value={panelContents[index]} onValueChange={(v) => handlePanelContentChange(index, v)}>
                <SelectTrigger data-testid={`panel-header-select-${index}`} className="w-[140px] h-7 text-xs bg-transparent border-none focus:ring-0 shadow-none">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="links">Links</SelectItem>
                    <SelectItem value="resources">Resources</SelectItem>
                    <SelectItem value="dates">Dates</SelectItem>
                    <SelectItem value="notes">Activity Log</SelectItem>
                    <SelectItem value="resource-table">Resource Table</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-card border-t rounded-t-lg overflow-hidden">
            <div className={cn(
                    "flex items-center justify-between border-b shrink-0",
                    (uiDensity === 'large' && !isMobile) && 'p-4',
                    (uiDensity === 'medium' && !isMobile) && 'p-3',
                    (uiDensity === 'compact' || isMobile) && 'p-2'
                )}>
                <div>
                    <h2 className={cn(
                        "font-semibold",
                        (uiDensity === 'large' && !isMobile) && 'text-lg',
                        (uiDensity === 'medium' && !isMobile) && 'text-base',
                        (uiDensity === 'compact' || isMobile) && 'text-base'
                    )}>{task.name}</h2>
                    <p className={cn(
                        "text-muted-foreground",
                         (uiDensity === 'large' && !isMobile) && 'text-sm',
                         (uiDensity === 'medium' && !isMobile) && 'text-xs',
                         (uiDensity === 'compact' || isMobile) && 'text-xs'
                    )}>
                        {format(new Date(task.start), dateFormat)} - {format(new Date(task.finish), dateFormat)} ({task.duration} working days)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isMobile && (
                        <ToggleGroup type="single" value={layout} onValueChange={(v) => v && setLayout(v as any)} className="mr-2 border rounded-md p-0.5">
                            <ToggleGroupItem value="single" aria-label="Single View" size="sm" className="h-6 w-6 p-0">
                                <RectangleHorizontal className="h-3 w-3" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="split-2" aria-label="Two Columns" size="sm" className="h-6 w-6 p-0">
                                <Columns className="h-3 w-3" />
                            </ToggleGroupItem>
                            <ToggleGroupItem value="split-3" aria-label="Three Columns" size="sm" className="h-6 w-6 p-0">
                                <Columns3 className="h-3 w-3" />
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div>
            </div>

            {/* Content Area */}
            {(isMobile || layout === 'single') ? (
                <Tabs defaultValue="links" className="flex-grow flex flex-col overflow-hidden">
                    <div className={cn(
                        "shrink-0 border-b",
                        (uiDensity === 'large' && !isMobile) && 'px-4',
                        (uiDensity === 'medium' && !isMobile) && 'px-3',
                        (uiDensity === 'compact' || isMobile) && 'px-2'
                    )}>
                        <TabsList className="bg-transparent p-0">
                            <TabsTrigger value="links" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Links</TabsTrigger>
                            <TabsTrigger value="resources" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Resources</TabsTrigger>
                            <TabsTrigger value="dates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Dates</TabsTrigger>
                            <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Activity Log</TabsTrigger>
                            <TabsTrigger value="resource-table" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none -mb-px">Resource Table</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-grow overflow-auto">
                        <TabsContent value="links" className="m-0 h-full">
                            {renderPanelContent('links')}
                        </TabsContent>
                        <TabsContent value="resources" className="m-0 h-full">
                            {renderPanelContent('resources')}
                        </TabsContent>
                        <TabsContent value="dates" className="m-0 h-full">
                            {renderPanelContent('dates')}
                        </TabsContent>
                        <TabsContent value="notes" className="m-0 h-full">
                            {renderPanelContent('notes')}
                        </TabsContent>
                        <TabsContent value="resource-table" className="m-0 h-full">
                            {renderPanelContent('resource-table')}
                        </TabsContent>
                    </div>
                </Tabs>
            ) : (
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={layout === 'split-2' ? 50 : 33}>
                        <div className="flex flex-col h-full">
                            <PanelHeader index={0} />
                            <div className="flex-grow overflow-auto">
                                {renderPanelContent(panelContents[0])}
                            </div>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={layout === 'split-2' ? 50 : 33}>
                         <div className="flex flex-col h-full">
                            <PanelHeader index={1} />
                            <div className="flex-grow overflow-auto">
                                {renderPanelContent(panelContents[1])}
                            </div>
                        </div>
                    </ResizablePanel>

                    {layout === 'split-3' && (
                        <>
                            <ResizableHandle withHandle />
                            <ResizablePanel defaultSize={33}>
                                 <div className="flex flex-col h-full">
                                    <PanelHeader index={2} />
                                    <div className="flex-grow overflow-auto">
                                        {renderPanelContent(panelContents[2])}
                                    </div>
                                </div>
                            </ResizablePanel>
                        </>
                    )}
                </ResizablePanelGroup>
            )}
        </div>
    );
}
