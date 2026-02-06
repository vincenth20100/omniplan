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
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";
import { Upload, Loader2, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseProjectXML, parsePrimaveraXER, ImportedProjectData } from "@/lib/import-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsParsing(true);
        setError(null);
        setImportData(null);

        try {
            const text = await selectedFile.text();
            let data: ImportedProjectData | null = null;

            if (selectedFile.name.toLowerCase().endsWith('.xml')) {
                data = parseProjectXML(text);
            } else if (selectedFile.name.toLowerCase().endsWith('.xer')) {
                data = parsePrimaveraXER(text);
            } else {
                throw new Error("Unsupported file format. Please use .xml (MS Project) or .xer (Primavera P6).");
            }

            if (data) {
                if (data.tasks.length === 0) {
                    setError("No tasks found in the file.");
                } else {
                    setImportData(data);
                }
            }
        } catch (err) {
            console.error(err);
            setError((err as Error).message || "Failed to parse file.");
        } finally {
            setIsParsing(false);
        }
    };

    const handleImportClick = () => {
        if (importData) {
            onImport(importData);
            onOpenChange(false);
            // Reset state
            setFile(null);
            setImportData(null);
            setError(null);
        }
    };

    const handleReset = () => {
        setFile(null);
        setImportData(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Import Project</DialogTitle>
                    <DialogDescription>
                        Upload a Microsoft Project (.xml) or Primavera P6 (.xer) file to create a new project.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {!file ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 hover:bg-muted/50 cursor-pointer transition-colors"
                             onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                            <p className="text-sm font-medium text-muted-foreground">Click to upload or drag and drop</p>
                            <p className="text-xs text-muted-foreground mt-1">.xml or .xer files supported</p>
                            <Input
                                ref={fileInputRef}
                                id="file-upload"
                                type="file"
                                accept=".xml,.xer"
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

                            {importData && (
                                <div className="space-y-2">
                                    <Alert className="bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400">
                                        <CheckCircle2 className="h-4 w-4 stroke-green-600 dark:stroke-green-400" />
                                        <AlertTitle>Ready to Import</AlertTitle>
                                        <AlertDescription>
                                            Found {importData.tasks.length} tasks, {importData.resources.length} resources, and {importData.links.length} dependencies.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="text-sm text-muted-foreground">
                                        <p>Project Name: <span className="font-medium text-foreground">{importData.name}</span></p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleImportClick} disabled={!importData || isParsing}>
                        Import Project
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
