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
import { Upload, Loader2, FileText, AlertTriangle, FileSpreadsheet, FileType } from "lucide-react";
import { parseProjectXML, parseProjectExcel, ImportedProjectData } from "@/lib/import-utils";
import { fetchProjectAnalysis, convertAnalysisToImportData, HFAnalyzeResponse } from "@/lib/omniplan-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ImportPreview } from "./import-preview";
import { AnalysisPreview } from "./analysis-preview";

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (data: ImportedProjectData) => void;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [importData, setImportData] = useState<ImportedProjectData | null>(null);
    const [analysisData, setAnalysisData] = useState<HFAnalyzeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [xmlSource, setXmlSource] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showMppGuide, setShowMppGuide] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsParsing(true);
        setError(null);
        setServerError(null);
        setImportData(null);
        setAnalysisData(null);
        setXmlSource(null);
        setShowPreview(false);
        setShowMppGuide(false);

        try {
            const name = selectedFile.name.toLowerCase();
            let data: ImportedProjectData | null = null;

            if (name.endsWith('.xml')) {
                const text = await selectedFile.text();
                data = parseProjectXML(text);
            } else if (name.endsWith('.mpp') || name.endsWith('.xer')) {
                 // Use OmniPlan API for analysis (Review Mode)
                 const raw = await fetchProjectAnalysis(selectedFile);
                 setAnalysisData(raw);
                 // We don't set importData here yet; we wait for user confirmation
            } else if (name.endsWith('.xlsx') || name.endsWith('.csv')) {
                const buffer = await selectedFile.arrayBuffer();
                data = await parseProjectExcel(buffer);
            } else if (name.endsWith('.mpx') || name.endsWith('.pp') || name.endsWith('.gan')) {
                 // Server-Side Conversion for binary formats or non-native XMLs
                 try {
                     const formData = new FormData();
                     formData.append('file', selectedFile);

                     const response = await fetch('/api/convert-project', {
                         method: 'POST',
                         body: formData
                     });

                     if (response.ok) {
                         const xmlText = await response.text();
                         setXmlSource(xmlText);
                         data = parseProjectXML(xmlText);
                     } else {
                         const errData = await response.json().catch(() => ({}));
                         console.warn("Project Conversion unavailable:", errData);

                         setServerError(errData.details || errData.error || "Server conversion failed");
                         setShowMppGuide(true);
                         setIsParsing(false);
                         return;
                     }
                 } catch (fetchErr) {
                     console.error("Network error during project conversion:", fetchErr);
                     setServerError("Network error during conversion");
                     setShowMppGuide(true);
                     setIsParsing(false);
                     return;
                 }
            } else {
                throw new Error("Unsupported file format. Please use .xml, .xer, .xlsx, .csv, .mpp, .mpx, .pp, or .gan.");
            }

            if (data) {
                if (data.tasks.length === 0) {
                    setError("No tasks found in the file.");
                } else {
                    setImportData(data);
                    setShowPreview(true);
                }
            } else if (!analysisData && !name.endsWith('.mpp') && !name.endsWith('.xer')) {
                 // Should be covered by logic above, but safety check
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
        setAnalysisData(null);
        setXmlSource(null);
        setError(null);
        setServerError(null);
        setShowPreview(false);
        setShowMppGuide(false);
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

    const handleConfirmAnalysis = () => {
        if (analysisData && file) {
            const data = convertAnalysisToImportData(analysisData, file.name);
            onImport(data);
            onOpenChange(false);
            handleReset();
        }
    };

    // Determine content width based on active view
    const isWide = showPreview || (analysisData !== null);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={isWide ? "sm:max-w-[850px]" : "sm:max-w-[500px]"}>
                <DialogHeader>
                    <DialogTitle>Import Project</DialogTitle>
                    {!showPreview && !showMppGuide && !analysisData && (
                        <DialogDescription>
                            Upload a project file to create a new project.
                            <br />
                            Supported formats: MS Project (.xml, .mpp, .mpx), Excel (.xlsx, .csv), Primavera P6 (.xer), Planner (.gan), Asta (.pp).
                        </DialogDescription>
                    )}
                </DialogHeader>

                {showMppGuide ? (
                    <div className="space-y-4 py-2">
                        {serverError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Conversion Failed</AlertTitle>
                                <AlertDescription>{serverError}</AlertDescription>
                            </Alert>
                        )}
                        <Alert className="bg-blue-50 border-blue-200">
                             <FileType className="h-4 w-4 text-blue-600" />
                             <AlertTitle className="text-blue-800">Conversion Failed</AlertTitle>
                             <AlertDescription className="text-blue-700">
                                 Direct import of this proprietary format failed. Please try exporting to XML.
                             </AlertDescription>
                        </Alert>

                        <div className="space-y-3 text-sm">
                            <p>To import your project, please use Microsoft Project to save it in a supported format:</p>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                                <li>Open your project in Microsoft Project</li>
                                <li>Go to <strong>File &gt; Save As</strong></li>
                                <li>Choose <strong>XML Format (*.xml)</strong> OR <strong>Excel Workbook (*.xlsx)</strong></li>
                                <li>Save the file and upload it here</li>
                            </ol>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={handleReset}>Back</Button>
                            <Button onClick={() => fileInputRef.current?.click()}>Upload Converted File</Button>
                        </div>
                    </div>
                ) : analysisData ? (
                    <AnalysisPreview
                        data={analysisData}
                        fileName={file?.name || "Unknown File"}
                        onCancel={handleReset}
                        onConfirm={handleConfirmAnalysis}
                    />
                ) : showPreview && importData ? (
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
                                    <p className="text-xs text-muted-foreground mt-1">.xml, .xlsx, .csv, .xer, .mpp, .mpx, .pp, .gan</p>
                                    <Input
                                        ref={fileInputRef}
                                        id="file-upload"
                                        type="file"
                                        accept=".xml,.xer,.mpp,.xlsx,.csv,.mpx,.pp,.gan"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/20">
                                        {file.name.endsWith('.xlsx') || file.name.endsWith('.csv') ? (
                                            <FileSpreadsheet className="h-6 w-6 text-green-600" />
                                        ) : (
                                            <FileText className="h-6 w-6 text-primary" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleReset}>Change</Button>
                                    </div>

                                    {isParsing && (
                                        <div className="flex items-center justify-center p-4">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <span className="ml-2 text-sm">Analyzing file...</span>
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
