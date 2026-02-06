'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { Upload, Loader2, FileText, AlertTriangle } from "lucide-react";
import { parseProjectXML, parsePrimaveraXER, ImportedProjectData } from "@/lib/import-utils";
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
    const [showPreview, setShowPreview] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsParsing(true);
        setError(null);
        setImportData(null);
        setShowPreview(false);

        try {
            const text = await selectedFile.text();
            let data: ImportedProjectData | null = null;
            const name = selectedFile.name.toLowerCase();

            if (name.endsWith('.xml')) {
                data = parseProjectXML(text);
            } else if (name.endsWith('.xer')) {
                data = parsePrimaveraXER(text);
            } else if (name.endsWith('.mpp')) {
                 if (text.trim().startsWith('<')) {
                     // Try parsing as XML
                     data = parseProjectXML(text);
                 } else {
                     throw new Error("Direct binary .mpp import is not supported. Please save your project as XML in Microsoft Project to import.");
                 }
            } else {
                throw new Error("Unsupported file format. Please use .xml, .mpp (XML format), or .xer.");
            }

            if (data) {
                if (data.tasks.length === 0) {
                    setError("No tasks found in the file.");
                } else {
                    setImportData(data);
                    setShowPreview(true);
                }
            }
        } catch (err) {
            console.error(err);
            setError((err as Error).message || "Failed to parse file.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setImportData(null);
        setError(null);
        setShowPreview(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleConfirmImport = () => {
        if (importData) {
            onImport(importData);
            onOpenChange(false);
            handleReset();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={showPreview ? "sm:max-w-[850px]" : "sm:max-w-[500px]"}>
                <DialogHeader>
                    <DialogTitle>Import Project</DialogTitle>
                    {!showPreview && (
                        <DialogDescription>
                            Upload a Microsoft Project (.xml, .mpp) or Primavera P6 (.xer) file to create a new project.
                        </DialogDescription>
                    )}
                </DialogHeader>

                {showPreview && importData ? (
                    <ImportPreview
                        data={importData}
                        onCancel={handleReset}
                        onConfirm={handleConfirmImport}
                    />
                ) : (
                    <>
                        <div className="grid gap-4 py-4">
                            {!file ? (
                                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 hover:bg-muted/50 cursor-pointer transition-colors"
                                     onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                                    <p className="text-sm font-medium text-muted-foreground">Click to upload or drag and drop</p>
                                    <p className="text-xs text-muted-foreground mt-1">.xml, .mpp (XML), or .xer files</p>
                                    <Input
                                        ref={fileInputRef}
                                        id="file-upload"
                                        type="file"
                                        accept=".xml,.xer,.mpp"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/20">
                                        <FileText className="h-6 w-6 text-primary" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleReset}>Change</Button>
                                    </div>

                                    {isParsing && (
                                        <div className="flex items-center justify-center p-4">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <span className="ml-2 text-sm">Parsing file...</span>
                                        </div>
                                    )}

                                    {error && (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Error</AlertTitle>
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
