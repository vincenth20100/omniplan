'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StylePreset, GanttSettings } from "@/lib/types";
import { useState, useEffect } from 'react';
import { Plus, Trash2, Copy } from "lucide-react";
import { EditableCell } from "../omni-gantt/editable-cell";

export function ThemeManagementDialog({
    open,
    onOpenChange,
    stylePresets,
    currentSettings,
    dispatch,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stylePresets: StylePreset[];
    currentSettings: GanttSettings;
    dispatch: any;
}) {
    const [localPresets, setLocalPresets] = useState<StylePreset[]>([]);
    const [presetToDelete, setPresetToDelete] = useState<StylePreset | null>(null);

    useEffect(() => {
        if (open) {
            setLocalPresets(stylePresets);
        }
    }, [open, stylePresets]);

    const handleSave = () => {
        dispatch({ type: 'SET_STYLE_PRESETS', payload: localPresets });
        onOpenChange(false);
    };

    const handleAddPreset = () => {
        const newPreset: StylePreset = {
            id: `preset-${Date.now()}`,
            name: "My New Theme",
            settings: {
                theme: currentSettings.theme || 'dark',
                customStyles: currentSettings.customStyles || {},
            }
        };
        setLocalPresets([...localPresets, newPreset]);
    };

    const handleClonePreset = (presetToClone: StylePreset) => {
         const newPreset: StylePreset = {
            id: `preset-${Date.now()}`,
            name: `${presetToClone.name} (Copy)`,
            settings: JSON.parse(JSON.stringify(presetToClone.settings)),
        };
        setLocalPresets([...localPresets, newPreset]);
    };

    const handleDeletePreset = () => {
        if (presetToDelete) {
            setLocalPresets(localPresets.filter(p => p.id !== presetToDelete.id));
            setPresetToDelete(null);
        }
    };
    
    const handleRenamePreset = (id: string, newName: string) => {
        setLocalPresets(localPresets.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const getBaseThemeName = (themeValue: 'light' | 'dark' | 'sepia') => {
        switch(themeValue) {
            case 'light': return 'Light';
            case 'dark': return 'Dark';
            case 'sepia': return 'Sepia';
            default: return 'Unknown';
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Custom Themes</DialogTitle>
                </DialogHeader>

                <div className="flex-grow overflow-hidden border rounded-md">
                     <ScrollArea className="h-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Theme Name</TableHead>
                                    <TableHead>Base</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localPresets.map(preset => (
                                    <TableRow key={preset.id}>
                                        <TableCell>
                                            {preset.isDefault ? (
                                                <span>{preset.name}</span>
                                            ) : (
                                                <EditableCell
                                                    value={preset.name}
                                                    onSave={(newName) => handleRenamePreset(preset.id, newName)}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>{getBaseThemeName(preset.settings.theme)}</TableCell>
                                        <TableCell className="text-right">
                                             <Button variant="ghost" size="icon" onClick={() => handleClonePreset(preset)} title="Clone theme">
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                            {!preset.isDefault && (
                                                <Button variant="ghost" size="icon" onClick={() => setPresetToDelete(preset)} title="Delete theme">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                <div className="flex justify-start">
                     <Button variant="outline" onClick={handleAddPreset}>
                        <Plus className="mr-2 h-4 w-4" /> New Theme from Current Settings
                    </Button>
                </div>


                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save and Close</Button>
                </DialogFooter>

                <AlertDialog open={!!presetToDelete} onOpenChange={(isOpen) => !isOpen && setPresetToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                            This will permanently delete the theme "{presetToDelete?.name}". This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeletePreset} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}
