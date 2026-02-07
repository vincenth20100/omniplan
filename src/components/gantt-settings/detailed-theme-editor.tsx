'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { THEME_VARIABLES, THEME_PRESETS, ThemeVariableConfig } from "@/lib/theme-config";
import type { GanttSettings, StylePreset, TaskLabelSetting } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Copy, RotateCcw, Save, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useThemeContext } from '@/components/theme/theme-context';
import { Switch } from "@/components/ui/switch";

// --- Color Helpers ---

const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const hexToHsl = (hex: string): { h: number, s: number, l: number } | null => {
    let r = 0, g = 0, b = 0;
    if (hex.startsWith('#')) hex = hex.slice(1);

    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        return null;
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// Parses "H S% L%" string to hex
const hslStringToHex = (hslString: string): string => {
    const parts = hslString.split(' ').map(p => parseFloat(p));
    if (parts.length >= 3) {
        return hslToHex(parts[0], parts[1], parts[2]);
    }
    return '#000000';
}

// --- Components ---

const ColorInput = ({
    value,
    onChange,
    label,
    type
}: {
    value: string,
    onChange: (val: string) => void,
    label: string,
    type: 'color-hsl' | 'color-css' | 'size'
}) => {
    const [localHex, setLocalHex] = useState('#000000');

    useEffect(() => {
        if (type === 'color-hsl') {
            setLocalHex(hslStringToHex(value || '0 0% 0%'));
        } else if (type === 'color-css' && value?.startsWith('#')) {
            setLocalHex(value);
        }
    }, [value, type]);

    const handleColorChange = (hex: string) => {
        setLocalHex(hex);
        if (type === 'color-hsl') {
            const hsl = hexToHsl(hex);
            if (hsl) {
                onChange(`${hsl.h} ${hsl.s}% ${hsl.l}%`);
            }
        } else {
            onChange(hex);
        }
    };

    return (
        <div className="flex items-center justify-between py-2">
            <Label className="text-sm truncate mr-2" title={label}>{label}</Label>
            <div className="flex items-center gap-2">
                {type !== 'size' && (
                     <div className="relative w-8 h-8 rounded-full overflow-hidden border shadow-sm shrink-0">
                        <input
                            type="color"
                            value={localHex}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                        />
                    </div>
                )}
                <Input
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 w-32 font-mono text-xs"
                />
            </div>
        </div>
    );
};

const MockTaskBar = ({
    task,
    taskLabels,
    colorClass,
    textClass,
    borderClass
}: {
    task: any,
    taskLabels: TaskLabelSetting[],
    colorClass: string,
    textClass?: string,
    borderClass?: string
}) => {
    // default content (fallback)
    const defaultContent = (
         <div className={cn(
            "relative px-2 text-[10px] truncate w-full flex justify-between items-center",
            textClass || "text-primary-foreground"
        )}>
            <span>{task.name}</span>
        </div>
    );

    return (
        <div className={cn("absolute h-5 rounded-sm shadow-sm flex items-center", colorClass, borderClass)}
             style={{
                 left: task.left,
                 width: task.width,
                 top: task.top
             }}
        >
             {(!taskLabels || taskLabels.length === 0) ? defaultContent : (
                <>
                 {taskLabels.map((labelSetting, index) => {
                     let content = '';
                     switch(labelSetting.field) {
                         case 'name': content = task.name; break;
                         case 'start': content = format(task.start, "MMM dd"); break;
                         case 'finish': content = format(task.finish, "MMM dd"); break;
                         case 'duration': content = task.durationStr; break;
                         case 'percentComplete': content = `${task.percentComplete}%`; break;
                         default: content = '';
                     }

                     const positionClasses = {
                         inside: "left-0 top-0 w-full h-full flex items-center px-2 overflow-visible",
                         left: "right-full top-1/2 -translate-y-1/2 mr-2 justify-end text-foreground",
                         right: "left-full top-1/2 -translate-y-1/2 ml-2 justify-start text-foreground",
                         top: "bottom-full left-1/2 -translate-x-1/2 mb-1 justify-center text-foreground",
                         bottom: "top-full left-1/2 -translate-x-1/2 mt-1 justify-center text-foreground"
                     };

                     const isInside = labelSetting.location === 'inside';
                     const finalTextColorClass = isInside
                        ? (textClass || "text-primary-foreground")
                        : "text-foreground";

                     return (
                         <div
                            key={index}
                            className={cn(
                                "absolute text-[10px] whitespace-nowrap pointer-events-none flex z-20 drop-shadow-md",
                                positionClasses[labelSetting.location],
                                finalTextColorClass
                            )}
                         >
                            {content}
                         </div>
                     );
                 })}
                </>
             )}
        </div>
    )
}

const PreviewPane = ({ theme, customStyles, settings }: { theme: string, customStyles: Record<string, string>, settings: GanttSettings }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            // Apply variables to the container
            const style = containerRef.current.style;
            // First clear existing
             style.cssText = '';

            // Apply custom styles
            Object.entries(customStyles).forEach(([key, value]) => {
                 style.setProperty(key, value);
            });
        }
    }, [customStyles, theme]);

    // Mock data for preview
    const mockTasks = [
        {
            name: "Research",
            start: new Date(2023, 10, 13), // Mon
            finish: new Date(2023, 10, 15), // Wed
            durationStr: "3d",
            percentComplete: 0,
            left: "10%",
            width: "30%",
            colorClass: "bg-gantt-bar-default",
            textClass: "text-primary-foreground",
            top: "6px" // 1.5 * 4 = 6px
        },
        {
            name: "Planning",
            start: new Date(2023, 10, 15),
            finish: new Date(2023, 10, 17),
            durationStr: "2d",
            percentComplete: 0,
            left: "45%",
            width: "20%",
            colorClass: "bg-gantt-bar-critical",
            textClass: "text-destructive-foreground",
            borderClass: "border border-destructive",
            top: "6px",
            isCritical: true
        }
    ];

    return (
        <div
            ref={containerRef}
            className={cn(
                "w-full h-full border rounded-lg overflow-hidden flex flex-col relative transition-colors duration-200",
                theme, // This applies the class .dark or .sepia if they are defined in globals.css
                // We need to ensure text-foreground and bg-background are applied
                "bg-background text-foreground"
            )}
        >
            {/* Header Mockup */}
            <div className="h-14 border-b flex items-center px-4 justify-between bg-card">
                <span className="font-semibold text-lg">Project Plan</span>
                <div className="flex gap-2">
                     <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">JD</div>
                </div>
            </div>

            {/* Content Mockup */}
            <div className="flex-1 p-4 flex gap-4 overflow-hidden bg-background">
                {/* Sidebar Mockup */}
                <div className="w-48 hidden md:flex flex-col gap-2 rounded-lg border bg-sidebar text-sidebar-foreground p-2">
                    <div className="h-8 rounded-md bg-sidebar-accent text-sidebar-accent-foreground flex items-center px-2 font-medium">
                        Overview
                    </div>
                    <div className="h-8 rounded-md flex items-center px-2 hover:bg-sidebar-accent/50 cursor-pointer">
                        Tasks
                    </div>
                    <div className="h-8 rounded-md flex items-center px-2 hover:bg-sidebar-accent/50 cursor-pointer">
                        Settings
                    </div>
                    <div className="mt-auto p-2 rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs text-center">
                        Pro Plan
                    </div>
                </div>

                {/* Main Content Mockup */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className="flex gap-2">
                        <Button>Primary Action</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="destructive">Destructive</Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Task Overview</CardTitle>
                                <CardDescription>Progress tracking</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Designing</span>
                                        <span className="text-muted-foreground">80%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                        <div className="h-full bg-primary w-[80%]" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle>Input Form</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Label>Task Name</Label>
                                <Input placeholder="Enter task name..." />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Mock Gantt Chart */}
                    <div className="border rounded-md flex-1 bg-card overflow-hidden flex flex-col">
                        <div className="border-b p-2 bg-muted/30 text-xs font-semibold flex">
                            <div className="w-1/4">Task</div>
                            <div className="flex-1 flex justify-between px-4">
                                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
                            </div>
                        </div>
                        <div className="flex-1 p-2 space-y-3 relative">
                            {/* Row 1 */}
                            <div className="flex items-center relative h-8 hover:bg-accent/10 rounded">
                                <div className="w-1/4 text-sm font-medium px-2">{mockTasks[0].name}</div>
                                <div className="flex-1 relative h-full">
                                    <MockTaskBar
                                        task={mockTasks[0]}
                                        taskLabels={settings.taskLabels || []}
                                        colorClass={mockTasks[0].colorClass}
                                        textClass={mockTasks[0].textClass}
                                    />
                                </div>
                            </div>
                            {/* Row 2 */}
                             <div className="flex items-center relative h-8 hover:bg-accent/10 rounded">
                                <div className="w-1/4 text-sm font-medium px-2">{mockTasks[1].name}</div>
                                <div className="flex-1 relative h-full">
                                    <MockTaskBar
                                        task={mockTasks[1]}
                                        taskLabels={settings.taskLabels || []}
                                        colorClass={mockTasks[1].colorClass}
                                        textClass={mockTasks[1].textClass}
                                        borderClass={mockTasks[1].borderClass}
                                    />
                                </div>
                            </div>
                            {/* Row 3 - Milestone */}
                             <div className="flex items-center relative h-8 hover:bg-accent/10 rounded">
                                <div className="w-1/4 text-sm font-medium px-2">Milestone</div>
                                <div className="flex-1 relative h-full">
                                    <div className="absolute top-2 left-[70%] w-4 h-4 bg-milestone-default rotate-45 transform origin-center shadow-sm" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export function DetailedThemeEditor({
    open,
    onOpenChange,
    settings,
    stylePresets,
    onSave,
    dispatch
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: GanttSettings;
    stylePresets: StylePreset[];
    onSave: (settings: GanttSettings) => void;
    dispatch: any;
}) {
    const [baseTheme, setBaseTheme] = useState<'light' | 'dark' | 'sepia'>(settings.theme || 'dark');
    const [customStyles, setCustomStyles] = useState<Record<string, string>>({});
    const [taskLabels, setTaskLabels] = useState<TaskLabelSetting[]>(settings.taskLabels || []);
    const [presetName, setPresetName] = useState('');
    const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');

    // New label state
    const [newLabelField, setNewLabelField] = useState('name');
    const [newLabelLocation, setNewLabelLocation] = useState<'inside' | 'left' | 'right' | 'top' | 'bottom'>('inside');

    const { isCustomizing, setIsCustomizing, layoutConfig, setLayoutConfig, sidebarConfig, setSidebarConfig } = useThemeContext();

    const handleLayoutChange = (key: string, value: any) => {
        setLayoutConfig({ ...layoutConfig, [key]: value });
    };

    const handleToggleGroupLabel = (groupId: string, show: boolean) => {
        const newConfig = sidebarConfig.map(g => g.id === groupId ? { ...g, showLabel: show } : g);
        setSidebarConfig(newConfig);
    };

    // Initialize state when opening
    useEffect(() => {
        if (open) {
            setBaseTheme(settings.theme || 'dark');
            setTaskLabels(settings.taskLabels || []);

            // Map legacy keys to new keys for editing
            const legacyMap: Record<string, string> = {
                ganttBarDefault: '--gantt-bar-default',
                ganttBarCritical: '--gantt-bar-critical',
                milestoneDefault: '--milestone-default',
                milestoneCritical: '--milestone-critical',
                taskRowLevel0Bg: '--task-row-level-0-bg',
                taskRowLevel1Bg: '--task-row-level-1-bg',
                taskRowLevel2PlusBg: '--task-row-level-2-plus-bg',
            };

            const styles = { ...(settings.customStyles || {}) };
            const normalizedStyles: Record<string, string> = {};

            Object.entries(styles).forEach(([key, value]) => {
                if (legacyMap[key]) {
                    normalizedStyles[legacyMap[key]] = value;
                } else {
                    normalizedStyles[key] = value;
                }
            });

            setCustomStyles(normalizedStyles);

            // Try to match with a preset
            const currentPreset = stylePresets.find(p => p.id === settings.theme); // This logic is weak, usually checked via deep equality
            // We default to 'custom' unless explicitly told otherwise or we track it.
        }
    }, [open, settings, stylePresets]);

    const handleStyleChange = (key: string, value: string) => {
        setCustomStyles(prev => ({ ...prev, [key]: value }));
        setSelectedPresetId('custom');
    };

    const handleApplyPreset = (presetId: string) => {
        setSelectedPresetId(presetId);
        if (presetId === 'custom') return;

        // Combine user presets and default presets
        const allPresets = [...stylePresets, ...THEME_PRESETS];
        const preset = allPresets.find(p => p.id === presetId);

        if (preset) {
            setBaseTheme(preset.settings.theme);
            setCustomStyles(preset.settings.customStyles || {});
            // Note: Presets currently don't store taskLabels, but they could.
            // If they did, we would set them here.
        }
    };

    const handleSave = () => {
        onSave({
            ...settings,
            theme: baseTheme,
            customStyles,
            taskLabels
        });
        onOpenChange(false);
    };

    const handleAddTaskLabel = () => {
        setTaskLabels([...taskLabels, { field: newLabelField, location: newLabelLocation }]);
    };

    const handleRemoveTaskLabel = (index: number) => {
        setTaskLabels(taskLabels.filter((_, i) => i !== index));
    };

    const handleSaveAsPreset = () => {
        if (!presetName) return;
        const newPreset: StylePreset = {
            id: `preset-${Date.now()}`,
            name: presetName,
            isDefault: false,
            settings: {
                theme: baseTheme,
                customStyles
            }
        };
        // We need to dispatch to add this to the project state
        dispatch({ type: 'SET_STYLE_PRESETS', payload: [...stylePresets, newPreset] });
        setPresetName('');
        // Also select it?
        // setSelectedPresetId(newPreset.id); // Would require re-fetching/re-syncing logic
    };

    const handleDeletePreset = (id: string) => {
         dispatch({ type: 'SET_STYLE_PRESETS', payload: stylePresets.filter(p => p.id !== id) });
         if (selectedPresetId === id) setSelectedPresetId('custom');
    };

    const categories = Array.from(new Set(THEME_VARIABLES.map(v => v.category)));

    const combinedPresets = useMemo(() => {
        // Filter out defaults from stylePresets if they are already in THEME_PRESETS to avoid duplicates if accidentally saved
        const userPresets = stylePresets.filter(p => !p.isDefault);
        // Or if stylePresets contains defaults, we just use it.
        // Assuming stylePresets contains all available presets from state.
        // We add new defaults that might not be in state yet (e.g. newly added themes in code)
        const stateIds = new Set(stylePresets.map(p => p.id));
        const missingDefaults = THEME_PRESETS.filter(p => !stateIds.has(p.id));

        return [...stylePresets, ...missingDefaults];
    }, [stylePresets]);


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <div>
                            <DialogTitle>Theme Display Manager</DialogTitle>
                            <DialogDescription>Customize every aspect of your project's appearance.</DialogDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Apply Theme</Button>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar Controls */}
                        <div className="w-[400px] flex flex-col border-r bg-muted/10">
                            <ScrollArea className="flex-1">
                                <div className="p-6 space-y-6">
                                    {/* Presets */}
                                    <div className="space-y-2">
                                        <Label>Load Preset</Label>
                                        <Select value={selectedPresetId} onValueChange={handleApplyPreset}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a preset..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="custom">Custom Configuration</SelectItem>
                                                {combinedPresets.map(preset => (
                                                    <div key={preset.id} className="flex justify-between items-center w-full">
                                                         <SelectItem value={preset.id}>{preset.name}</SelectItem>
                                                    </div>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedPresetId !== 'custom' && !combinedPresets.find(p => p.id === selectedPresetId)?.isDefault && (
                                            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => handleDeletePreset(selectedPresetId)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Preset
                                            </Button>
                                        )}
                                    </div>

                                    <Separator />

                                    {/* Base Theme */}
                                    <div className="space-y-2">
                                        <Label>Base Mode</Label>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant={baseTheme === 'light' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setBaseTheme('light')}
                                                className="flex-1"
                                            >Light</Button>
                                             <Button
                                                variant={baseTheme === 'dark' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setBaseTheme('dark')}
                                                className="flex-1"
                                            >Dark</Button>
                                             <Button
                                                variant={baseTheme === 'sepia' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setBaseTheme('sepia')}
                                                className="flex-1"
                                            >Sepia</Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Sets the underlying Shadcn theme mode.</p>
                                    </div>

                                    <Separator />

                                    {/* Variables Accordion */}
                                    <Accordion type="single" collapsible className="w-full" defaultValue="Global">

                                    {/* Interface Layout */}
                                    <AccordionItem value="interface">
                                        <AccordionTrigger>Interface Layout</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="flex items-center justify-between">
                                                <Label>Edit Mode</Label>
                                                <Switch
                                                    checked={isCustomizing}
                                                    onCheckedChange={setIsCustomizing}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">Enable to drag & drop menu items and click to style.</p>

                                            <div className="space-y-2">
                                                <Label>Menu Position</Label>
                                                <Select
                                                    value={layoutConfig.sidebarPosition}
                                                    onValueChange={(v) => handleLayoutChange('sidebarPosition', v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="left">Left</SelectItem>
                                                        <SelectItem value="right">Right</SelectItem>
                                                        <SelectItem value="top">Top</SelectItem>
                                                        <SelectItem value="bottom">Bottom</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <Label>MacOS Hover Effect</Label>
                                                <Switch
                                                    checked={layoutConfig.enableMacOsHover}
                                                    onCheckedChange={(c) => handleLayoutChange('enableMacOsHover', c)}
                                                />
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>

                                        {categories.map(category => (
                                            <AccordionItem key={category} value={category}>
                                                <AccordionTrigger>{category} Variables</AccordionTrigger>
                                                <AccordionContent className="space-y-1 pt-2">
                                                    {THEME_VARIABLES.filter(v => v.category === category).map(variable => (
                                                        <ColorInput
                                                            key={variable.key}
                                                            label={variable.label}
                                                            value={customStyles[variable.key] || ''}
                                                            onChange={(val) => handleStyleChange(variable.key, val)}
                                                            type={variable.type}
                                                        />
                                                    ))}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}

                                        {/* Sidebar Configuration */}
                                        <AccordionItem value="sidebar-config">
                                            <AccordionTrigger>Sidebar Groups</AccordionTrigger>
                                            <AccordionContent className="pt-2 space-y-4">
                                                <div className="space-y-2">
                                                    {sidebarConfig.map((group) => (
                                                        <div key={group.id} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                                                            <span>{group.label}</span>
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-xs text-muted-foreground">Show Title</Label>
                                                                <Switch
                                                                    checked={group.showLabel}
                                                                    onCheckedChange={(c) => handleToggleGroupLabel(group.id, c)}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        {/* Task Labels Section */}
                                        <AccordionItem value="task-labels">
                                            <AccordionTrigger>Task Labels</AccordionTrigger>
                                            <AccordionContent className="pt-2 space-y-4">
                                                <div className="space-y-2">
                                                    {taskLabels.map((label, index) => (
                                                        <div key={index} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                                                            <span>{label.field} <span className="text-muted-foreground text-xs">({label.location})</span></span>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveTaskLabel(index)}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {taskLabels.length === 0 && <p className="text-xs text-muted-foreground italic">No custom labels configured.</p>}
                                                </div>

                                                <div className="space-y-2 border-t pt-2">
                                                    <Label className="text-xs">Add New Label</Label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Select value={newLabelField} onValueChange={setNewLabelField}>
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="name">Name</SelectItem>
                                                                <SelectItem value="start">Start Date</SelectItem>
                                                                <SelectItem value="finish">End Date</SelectItem>
                                                                <SelectItem value="duration">Duration</SelectItem>
                                                                <SelectItem value="percentComplete">% Complete</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Select value={newLabelLocation} onValueChange={(v: any) => setNewLabelLocation(v)}>
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="inside">Inside</SelectItem>
                                                                <SelectItem value="left">Left</SelectItem>
                                                                <SelectItem value="right">Right</SelectItem>
                                                                <SelectItem value="top">Above</SelectItem>
                                                                <SelectItem value="bottom">Below</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button size="sm" className="w-full" onClick={handleAddTaskLabel}>Add Label</Button>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>

                                    <Separator />

                                    {/* Save Preset */}
                                    <div className="space-y-2 pt-4">
                                        <Label>Save Configuration as Preset</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="My New Theme"
                                                value={presetName}
                                                onChange={e => setPresetName(e.target.value)}
                                            />
                                            <Button size="icon" disabled={!presetName} onClick={handleSaveAsPreset}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Preview Area */}
                        <div className="flex-1 bg-muted/30 p-8 flex flex-col overflow-hidden">
                             <div className="mb-4 flex items-center justify-between">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    Live Preview
                                </h3>
                                <Button variant="ghost" size="sm" onClick={() => setCustomStyles({})}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset Changes
                                </Button>
                             </div>
                             <div className="flex-1 shadow-2xl rounded-lg overflow-hidden border-4 border-muted">
                                <PreviewPane theme={baseTheme} customStyles={customStyles} settings={{...settings, taskLabels}} />
                             </div>
                             <p className="text-center text-xs text-muted-foreground mt-4">
                                This preview uses a simulated layout. Actual application layout may vary slightly.
                             </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
