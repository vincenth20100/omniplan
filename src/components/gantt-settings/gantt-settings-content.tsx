'use client';

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
import type { GanttSettings, StylePreset, Baseline } from "@/lib/types";
import { Input } from "../ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "../ui/button";

export function GanttSettingsContent({
  settings,
  stylePresets,
  activeStylePresetId,
  baselines,
  dispatch,
  onManageThemes,
  isEditor,
  onSetBaseline,
  onManageBaselines,
}: {
  settings: GanttSettings;
  stylePresets: StylePreset[];
  activeStylePresetId: string | null;
  baselines: Baseline[];
  dispatch: any;
  onManageThemes: () => void;
  isEditor: boolean;
  onSetBaseline?: () => void;
  onManageBaselines?: () => void;
}) {
  const handleSettingChange = (key: keyof GanttSettings, value: any) => {
    dispatch({
      type: 'UPDATE_GANTT_SETTINGS',
      payload: { ...settings, [key]: value },
    });
  };

  const tooltipOptions = [
    { id: 'name', label: 'Name' },
    { id: 'start', label: 'Start Date' },
    { id: 'finish', label: 'Finish Date' },
    { id: 'duration', label: 'Duration' },
    { id: 'percentComplete', label: 'Percent Complete' },
    { id: 'status', label: 'Status' },
    { id: 'wbs', label: 'WBS' },
    { id: 'notes', label: 'Notes Indicator' },
  ];

  const toggleTooltipField = (fieldId: string, checked: boolean) => {
    const currentFields = settings.tooltipFields || [];
    if (checked) {
        if (!currentFields.includes(fieldId)) {
            const allIds = tooltipOptions.map(o => o.id);
            const newFields = [...currentFields, fieldId].sort((a, b) => allIds.indexOf(a) - allIds.indexOf(b));
            handleSettingChange('tooltipFields', newFields);
        }
    } else {
        handleSettingChange('tooltipFields', currentFields.filter(id => id !== fieldId));
    }
  };

  return (
        <ScrollArea className="flex-grow h-full">
          <div className="grid gap-6 py-4 pr-4">
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
                    onValueChange={(value: 'day' | 'week' | 'month' | 'quarter' | 'semester' | 'year') => handleSettingChange('viewMode', value)}
                    disabled={!isEditor}
                  >
                    <SelectTrigger id="view-mode" className="w-[180px]">
                      <SelectValue placeholder="Select view mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                      <SelectItem value="semester">Semester</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
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

            {/* Tooltip Configuration Section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Tooltip Configuration</h4>
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      {tooltipOptions.map((option) => (
                          <div key={option.id} className="flex items-center space-x-2">
                              <Checkbox
                                  id={`tooltip-${option.id}`}
                                  checked={(settings.tooltipFields || []).includes(option.id)}
                                  onCheckedChange={(checked) => toggleTooltipField(option.id, checked as boolean)}
                                  disabled={!isEditor}
                              />
                              <Label htmlFor={`tooltip-${option.id}`}>{option.label}</Label>
                          </div>
                      ))}
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

            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Baseline Comparison</h4>
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="baseline-select">Show Baseline</Label>
                      <Select
                          value={settings.comparisonBaselineId || 'none'}
                          onValueChange={(value) => handleSettingChange('comparisonBaselineId', value === 'none' ? null : value)}
                          disabled={!isEditor}
                      >
                          <SelectTrigger id="baseline-select" className="w-[180px]">
                              <SelectValue placeholder="Select Baseline" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {baselines.map(b => (
                                  <SelectItem key={b.id} value={b.id}>
                                      {b.name}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                   <div className="flex flex-col gap-2">
                     <Button variant="outline" size="sm" onClick={onSetBaseline} disabled={!isEditor || !onSetBaseline}>Set Current as Baseline</Button>
                     <Button variant="outline" size="sm" onClick={onManageBaselines} disabled={!onManageBaselines}>Manage Baselines</Button>
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
                     <p className="text-sm text-muted-foreground">
                        Use the detailed theme manager to customize colors, fonts, and layout for the entire project.
                     </p>
                    <Button variant="outline" className="w-full" onClick={onManageThemes} disabled={!isEditor}>Open Theme Manager</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>
  );
}
