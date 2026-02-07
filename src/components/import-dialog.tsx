'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { Upload, Loader2, FileText, AlertTriangle } from "lucide-react";
// --------------------------------------------------------------------------
// FIX: Import 'analyzeProjectFile' instead of the missing 'fetchProjectAnalysis'
// --------------------------------------------------------------------------
import { analyzeProjectFile } from "@/lib/omniplan-utils";
import { ImportedProjectData } from "@/lib/import-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ImportPreview } from "./import-preview";

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (data: ImportedProjectData) => void;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [importData, setImportData] = useState<ImportedProjectData | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // We removed 'analysisData' and 'serverError' because the new utility handles 
    // conversions internally and returns standard data.

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsParsing(true);
        setError(null);
        setImportData(null);

        try {
            // ----------------------------------------------------------------------
            // CORE FIX: This single call now handles .mpp, .xer, .xml, and .xlsx
            // It automatically routes binary files to your Python backend.
            // ----------------------------------------------------------------------
            const data = await analyzeProjectFile(selectedFile);
            
            if (data && data.tasks.length > 0) {
                setImportData(data);
            } else {
                setError("No tasks found in the file.");
            }
        } catch (err: any) {
            console.error("Import error:", err);
            setError(err.message || "Failed to parse file.");
        } finally {
            setIsParsing(false);
            // Reset input so you can select the same file again if it failed
            e.target.value = "";
        }
    };

    const handleReset = () => {
        setFile(null);
        setImportData(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmImport = () => {
        if (importData) {
            onImport(importData);
            onOpenChange(false);
            handleReset();
        }
    };

    // Width adjustments based on whether we are showing the large preview table
    const isWide = !!importData;

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if(!val) handleReset();
            onOpenChange(val);
        }}>
            <DialogContent className={isWide ? "sm:max-w-[900px]" : "sm:max-w-[500px]"}>
                <DialogHeader>
                    <DialogTitle>Import Project</DialogTitle>
                    <DialogDescription className={importData ? "sr-only" : ""}>
                        {importData
                            ? "Review and confirm the imported project data."
                            : <>Upload a project file to create a new project.<br/>Supports: <strong>.mpp, .xer, .xml, .xlsx, .csv, .gan</strong></>
                        }
                    </DialogDescription>
                </DialogHeader>

                {importData ? (
                    // SHOW PREVIEW
                    <ImportPreview
                        data={importData}
                        sourceFile={file || undefined}
                        onCancel={handleReset}
                        onConfirm={handleConfirmImport}
                        onDownload={undefined} 
                    />
                ) : (
                    // SHOW UPLOAD STATE
                    <div className="space-y-4 py-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Import Failed</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className={`
                            relative border-2 border-dashed rounded-xl p-8 text-center transition-all
                            ${isParsing ? "bg-muted/50 border-muted" : "bg-muted/10 border-muted-foreground/25 hover:border-primary/50"}
                        `}>
                            {isParsing ? (
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <div className="space-y-1">
                                        <h3 className="font-semibold">Analyzing File...</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {file?.name.endsWith('.mpp') || file?.name.endsWith('.xer') 
                                                ? "Converting binary data on server..." 
                                                : "Parsing local file..."}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="p-4 rounded-full bg-primary/10 text-primary">
                                        <Upload className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Click to upload or drag and drop</p>
                                        <Input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".xml,.xer,.mpp,.mpt,.xlsx,.csv,.mpx,.pp,.gan"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* File Details (if file selected but failed) */}
                        {!isParsing && file && !importData && !error && (
                             <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/20">
                                <FileText className="h-5 w-5 text-primary" />
                                <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
                                <Button variant="ghost" size="sm" onClick={handleReset}>Change</Button>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Hide default footer when preview is active as it has its own buttons */}
                {!importData && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
