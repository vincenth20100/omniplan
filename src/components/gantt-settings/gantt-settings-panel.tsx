'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GanttSettings } from "@/lib/types";
import { Input } from "../ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useId } from "react";
import { cn } from "@/lib/utils";

const ColorPicker = ({ label, value, onChange, disabled }: { label: string, value: string, onChange: (value: string) => void, disabled?: boolean }) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className={cn(disabled && 'opacity-50')}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input 
          id={id}
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className="w-24 h-8"
          disabled={disabled}
        />
        <Input 
          type="color" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className="w-8 h-8 p-1 disabled:opacity-50"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function GanttSettingsPanel({
  open,
  onOpenChange,
  settings,
  dispatch,
  isEditor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GanttSettings;
  dispatch: any;
  isEditor?: boolean;
}) {
  const handleSettingChange = (key: keyof GanttSettings, value: any) => {
    if (!isEditor) return;
    dispatch({
      type: 'UPDATE_GANTT_SETTINGS',
      payload: { ...settings, [key]: value },
    });
  };

  const handleCustomStyleChange = (key: keyof NonNullable<GanttSettings['customStyles']>, value: string) => {
    if (!isEditor) return;
    handleSettingChange('customStyles', {
      ...(settings.customStyles || {}),
      [key]: value
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Display Options</SheetTitle>
          <SheetDescription>
            Customize the appearance of the Gantt chart and grid.
            {!isEditor && <p className="text-destructive mt-2">You have view-only permissions.</p>}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-grow pr-4 -mr-6">
          <div className="grid gap-6 py-4">
             {/* General Appearance Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Appearance</h4>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                  <Label htmlFor="theme-select" className={cn(!isEditor && 'opacity-50')}>Theme</Label>
                  <Select
                    value={settings.theme || 'dark'}
                    onValueChange={(value: 'light' | 'dark' | 'sepia') => handleSettingChange('theme', value)}
                    disabled={!isEditor}
                  >
                    <SelectTrigger id="theme-select" className="w-[180px]">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="sepia">Sepia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 <div className="flex items-center justify-between">
                  <Label htmlFor="date-format" className={cn(!isEditor && 'opacity-50')}>Date Format</Label>
                    <Input
                      id="date-format"
                      value={settings.dateFormat || 'MMM d, yyyy'}
                      onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                      className="w-[180px] h-9"
                      disabled={!isEditor}
                      />
                </div>
                 <p className="text-xs text-muted-foreground -mt-2">
                      Uses <a href="https://date-fns.org/v3.6.0/docs/format" target="_blank" rel="noopener noreferrer" className="underline">date-fns</a> format tokens.
                  </p>
              </div>
            </div>
            
            <Separator />
            
            {/* Timescale & Grid Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Timescale & Grid</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="view-mode" className={cn(!isEditor && 'opacity-50')}>Default Zoom</Label>
                  <Select
                    value={settings.viewMode}
                    onValueChange={(value: 'day' | 'week' | 'month') => handleSettingChange('viewMode', value)}
                    disabled={!isEditor}
                  >
                    <SelectTrigger id="view-mode" className="w-[180px]">
                      <SelectValue placeholder="Select view mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="highlight-non-working" className={cn(!isEditor && 'opacity-50')}>Highlight Non-Working Time</Label>
                  <Switch
                    id="highlight-non-working"
                    checked={settings.highlightNonWorkingTime}
                    onCheckedChange={(checked) => handleSettingChange('highlightNonWorkingTime', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-today-line" className={cn(!isEditor && 'opacity-50')}>Show "Today" Marker</Label>
                  <Switch
                    id="show-today-line"
                    checked={settings.showTodayLine}
                    onCheckedChange={(checked) => handleSettingChange('showTodayLine', checked)}
                    disabled={!isEditor}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Task Bar Rendering Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Task Bar Rendering</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-dependencies" className={cn(!isEditor && 'opacity-50')}>Show Dependency Links</Label>
                  <Switch
                    id="show-dependencies"
                    checked={settings.showDependencies}
                    onCheckedChange={(checked) => handleSettingChange('showDependencies', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-progress" className={cn(!isEditor && 'opacity-50')}>Show Task Progress</Label>
                  <Switch
                    id="show-progress"
                    checked={settings.showProgress}
                    onCheckedChange={(checked) => handleSettingChange('showProgress', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-task-labels" className={cn(!isEditor && 'opacity-50')}>Show Task Labels on Bar</Label>
                  <Switch
                    id="show-task-labels"
                    checked={settings.showTaskLabels}
                    onCheckedChange={(checked) => handleSettingChange('showTaskLabels', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="split-tasks" className={cn(!isEditor && 'opacity-50')}>Render Split Tasks</Label>
                  <Switch
                      id="split-tasks"
                      checked={!!settings.renderSplitTasks}
                      onCheckedChange={(checked) => handleSettingChange('renderSplitTasks', checked)}
                      disabled={!isEditor}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Conditional Styling Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Conditional Styling</h4>
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="critical-path" className={cn(!isEditor && 'opacity-50')}>Highlight Critical Path</Label>
                      <Switch
                          id="critical-path"
                          checked={settings.highlightCriticalPath}
                          onCheckedChange={(checked) => handleSettingChange('highlightCriticalPath', checked)}
                          disabled={!isEditor}
                      />
                  </div>
              </div>
            </div>
            
            <Separator />

            {/* Advanced Customization */}
            <Accordion type="single" collapsible disabled={!isEditor}>
              <AccordionItem value="item-1">
                <AccordionTrigger>Customize Theme</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <ColorPicker
                      label="Gantt Bar (Default)"
                      value={settings.customStyles?.ganttBarDefault || ''}
                      onChange={(value) => handleCustomStyleChange('ganttBarDefault', value)}
                      disabled={!isEditor}
                    />
                     <ColorPicker
                      label="Gantt Bar (Critical)"
                      value={settings.customStyles?.ganttBarCritical || ''}
                      onChange={(value) => handleCustomStyleChange('ganttBarCritical', value)}
                      disabled={!isEditor}
                    />
                     <ColorPicker
                      label="Milestone (Default)"
                      value={settings.customStyles?.milestoneDefault || ''}
                      onChange={(value) => handleCustomStyleChange('milestoneDefault', value)}
                      disabled={!isEditor}
                    />
                     <ColorPicker
                      label="Milestone (Critical)"
                      value={settings.customStyles?.milestoneCritical || ''}
                      onChange={(value) => handleCustomStyleChange('milestoneCritical', value)}
                      disabled={!isEditor}
                    />
                    <Separator className="my-4" />
                     <ColorPicker
                      label="Task Row (Level 0)"
                      value={settings.customStyles?.taskRowLevel0Bg || ''}
                      onChange={(value) => handleCustomStyleChange('taskRowLevel0Bg', value)}
                      disabled={!isEditor}
                    />
                     <ColorPicker
                      label="Task Row (Level 1)"
                      value={settings.customStyles?.taskRowLevel1Bg || ''}
                      onChange={(value) => handleCustomStyleChange('taskRowLevel1Bg', value)}
                      disabled={!isEditor}
                    />
                     <ColorPicker
                      label="Task Row (Level 2+)"
                      value={settings.customStyles?.taskRowLevel2PlusBg || ''}
                      onChange={(value) => handleCustomStyleChange('taskRowLevel2PlusBg', value)}
                      disabled={!isEditor}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
