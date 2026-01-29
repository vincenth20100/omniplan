
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
import type { GanttSettings, StylePreset } from "@/lib/types";
import { Input } from "../ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

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
          value={value || '#000000'}
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
  stylePresets,
  activeStylePresetId,
  dispatch,
  onManageThemes,
  isEditor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GanttSettings;
  stylePresets: StylePreset[];
  activeStylePresetId: string | null;
  dispatch: any;
  onManageThemes: () => void;
  isEditor: boolean;
}) {
  const handleSettingChange = (key: keyof GanttSettings, value: any) => {
    dispatch({
      type: 'UPDATE_GANTT_SETTINGS',
      payload: { ...settings, [key]: value },
    });
  };

  const handleCustomStyleChange = (key: keyof NonNullable<GanttSettings['customStyles']>, value: string) => {
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
          </SheetDescription>
           {!isEditor && <p className="mt-2 text-destructive font-semibold">You have view-only permissions. Your changes will not be saved.</p>}
        </SheetHeader>
        <ScrollArea className="flex-grow pr-4 -mr-6">
          <div className="grid gap-6 py-4">
             {/* General Appearance Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Appearance</h4>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                  <Label htmlFor="theme-select">Theme</Label>
                  <div className="flex items-center gap-2">
                    <Select
                        value={activeStylePresetId || 'custom'}
                        onValueChange={(value) => {
                            if (value !== 'custom') {
                                dispatch({ type: 'SET_ACTIVE_STYLE_PRESET', payload: { id: value }});
                            }
                        }}
                        disabled={!isEditor}
                    >
                        <SelectTrigger id="theme-select" className="w-[180px]">
                        <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          {(stylePresets || []).map(preset => (
                            <SelectItem key={preset.id} value={preset.id}>
                              {preset.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">
                            Custom
                          </SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                 <div className="flex items-center justify-between">
                  <Label htmlFor="date-format">Date Format</Label>
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
                  <Label htmlFor="view-mode">Default Zoom</Label>
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
                  <Label htmlFor="highlight-non-working">Highlight Non-Working Time</Label>
                  <Switch
                    id="highlight-non-working"
                    checked={settings.highlightNonWorkingTime}
                    onCheckedChange={(checked) => handleSettingChange('highlightNonWorkingTime', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-today-line">Show "Today" Marker</Label>
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
                  <Label htmlFor="show-dependencies">Show Dependency Links</Label>
                  <Switch
                    id="show-dependencies"
                    checked={settings.showDependencies}
                    onCheckedChange={(checked) => handleSettingChange('showDependencies', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-progress">Show Task Progress</Label>
                  <Switch
                    id="show-progress"
                    checked={settings.showProgress}
                    onCheckedChange={(checked) => handleSettingChange('showProgress', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-task-labels">Show Task Labels on Bar</Label>
                  <Switch
                    id="show-task-labels"
                    checked={settings.showTaskLabels}
                    onCheckedChange={(checked) => handleSettingChange('showTaskLabels', checked)}
                    disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="split-tasks">Render Split Tasks</Label>
                  <Switch
                      id="split-tasks"
                      checked={!!settings.renderSplitTasks}
                      onCheckedChange={(checked) => handleSettingChange('renderSplitTasks', checked)}
                      disabled={!isEditor}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="summary-duration-unit">Summary Task Duration Unit</Label>
                  <Select
                    value={settings.summaryDurationUnit || 'day'}
                    onValueChange={(value: 'day' | 'week' | 'month') => handleSettingChange('summaryDurationUnit', value)}
                    disabled={!isEditor}
                  >
                    <SelectTrigger id="summary-duration-unit" className="w-[180px]">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Working Days</SelectItem>
                      <SelectItem value="week">Weeks</SelectItem>
                      <SelectItem value="month">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Conditional Styling Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Conditional Styling</h4>
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="critical-path">Highlight Critical Path</Label>
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
            <Accordion type="single" collapsible>
              <AccordionItem value="item-1">
                <AccordionTrigger>Customize Theme</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="base-theme-select">Base Theme</Label>
                        <Select
                            value={settings.theme || 'dark'}
                            onValueChange={(value: 'light' | 'dark' | 'sepia') => handleSettingChange('theme', value)}
                            disabled={!isEditor}
                        >
                            <SelectTrigger id="base-theme-select" className="w-[180px]">
                                <SelectValue placeholder="Select base theme" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="sepia">Sepia</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator />
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
                    <Separator className="my-4" />
                    <Button variant="outline" className="w-full" onClick={onManageThemes} disabled={!isEditor}>Manage Custom Themes...</Button>
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
