'use client';

import { Button } from "@/components/ui/button";
import { FilePlus, FolderOpen, Save, Printer } from "lucide-react";
import { useRef } from 'react';
import type { ProjectState } from "@/lib/types";

export function FileExplorer({ 
    projectState, 
    dispatch,
    onPrintPreview,
}: { 
    projectState: ProjectState, 
    dispatch: any,
    onPrintPreview: () => void,
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleNew = () => {
        if (window.confirm('Are you sure you want to create a new project? All unsaved changes will be lost.')) {
            dispatch({ type: 'NEW_PROJECT' });
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target?.result as string);
                    dispatch({ type: 'LOAD_PROJECT', payload: json });
                } catch (error) {
                    console.error("Failed to parse project file", error);
                    alert("Error: Could not load the project file. It may be corrupted or in the wrong format.");
                }
            };
            reader.readAsText(file);
        }
        // Reset file input value to allow loading the same file again
        if(event.target) {
            event.target.value = '';
        }
    };

    const handleLoadClick = () => {
        fileInputRef.current?.click();
    };

    const handleSave = () => {
        // Deep copy and remove transient state
        const stateToSave = JSON.parse(JSON.stringify({
            ...projectState,
            selectedTaskIds: undefined,
            historyLog: undefined,
        }));
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stateToSave, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "omniplan_project.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handlePrint = () => {
        onPrintPreview();
    };

    return (
        <div className="p-2">
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">FILE</h3>
            <div className="flex flex-col gap-1">
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleNew}>
                    <FilePlus className="h-4 w-4" />
                    New
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLoadClick}>
                    <FolderOpen className="h-4 w-4" />
                    Load
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".json,application/json"
                    className="hidden"
                />
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleSave}>
                    <Save className="h-4 w-4" />
                    Save
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={handlePrint}>
                    <Printer className="h-4 w-4" />
                    Print / Export PDF
                </Button>
            </div>
        </div>
    );
}
