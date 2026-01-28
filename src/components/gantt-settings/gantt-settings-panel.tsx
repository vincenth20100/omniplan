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

export function GanttSettingsPanel({
  open,
  onOpenChange,
  settings,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GanttSettings;
  dispatch: any;
}) {
  const handleSettingChange = (key: keyof GanttSettings, value: any) => {
    dispatch({
      type: 'UPDATE_GANTT_SETTINGS',
      payload: { ...settings, [key]: value },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Gantt Display Options</SheetTitle>
          <SheetDescription>
            Customize the appearance of the Gantt chart.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          {/* Timescale & Grid Section */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Timescale & Grid</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="view-mode">View Mode</Label>
                <Select
                  value={settings.viewMode}
                  onValueChange={(value: 'day' | 'week' | 'month') => handleSettingChange('viewMode', value)}
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
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-today-line">Show "Today" Marker</Label>
                <Switch
                  id="show-today-line"
                  checked={settings.showTodayLine}
                  onCheckedChange={(checked) => handleSettingChange('showTodayLine', checked)}
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
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-progress">Show Task Progress</Label>
                <Switch
                  id="show-progress"
                  checked={settings.showProgress}
                  onCheckedChange={(checked) => handleSettingChange('showProgress', checked)}
                />
              </div>
               <div className="flex items-center justify-between">
                <Label htmlFor="show-task-labels">Show Task Labels on Bar</Label>
                <Switch
                  id="show-task-labels"
                  checked={settings.showTaskLabels}
                  onCheckedChange={(checked) => handleSettingChange('showTaskLabels', checked)}
                />
              </div>
               <div className="flex items-center justify-between">
                <Label htmlFor="split-tasks">Render Split Tasks</Label>
                 <Switch
                    id="split-tasks"
                    checked={settings.renderSplitTasks}
                    onCheckedChange={(checked) => handleSettingChange('renderSplitTasks', checked)}
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
                    <Label htmlFor="critical-path">Highlight Critical Path</Label>
                    <Switch
                        id="critical-path"
                        checked={settings.highlightCriticalPath}
                        onCheckedChange={(checked) => handleSettingChange('highlightCriticalPath', checked)}
                    />
                </div>
                 <p className="text-xs text-muted-foreground -mt-2">Custom color coding rules are coming soon.</p>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
