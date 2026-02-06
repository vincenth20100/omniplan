'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, FileType, CheckCircle, Download, FileSpreadsheet } from "lucide-react";
import { convertProjectFile } from "@/lib/omniplan-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function ConverterPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState<string | null>(null); // 'json', 'xml', 'xlsx' or null
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccess(null);
        }
    };

    const handleConvert = async (format: 'json' | 'xml' | 'xlsx') => {
        if (!file) return;
        setLoading(format);
        setError(null);
        setSuccess(null);

        try {
            const blob = await convertProjectFile(file, format);

            // Trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = format === 'xlsx' ? 'xlsx' : format; // json->json, xml->xml
            a.download = `${file.name.replace(/\.[^/.]+$/, "")}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            setSuccess(`Successfully converted to ${format.toUpperCase()}`);
        } catch (err) {
            console.error(err);
            setError((err as Error).message || "Conversion failed");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="container max-w-2xl mx-auto py-10 px-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Project File Converter</CardTitle>
                    <CardDescription>
                        Upload a Microsoft Project (.mpp) file and convert it to XML, JSON, or Excel.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Input
                            id="file"
                            type="file"
                            accept=".mpp"
                            onChange={handleFileChange}
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                            {file ? `Selected: ${file.name}` : "Select a .mpp file to begin"}
                        </p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Success</AlertTitle>
                            <AlertDescription className="text-green-700">{success}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-4 justify-end">
                    <Button
                        variant="outline"
                        disabled={!file || !!loading}
                        onClick={() => handleConvert('xml')}
                    >
                        {loading === 'xml' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileType className="mr-2 h-4 w-4" />}
                        Export to XML
                    </Button>
                    <Button
                        variant="outline"
                        disabled={!file || !!loading}
                        onClick={() => handleConvert('xlsx')}
                    >
                         {loading === 'xlsx' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                        Export to Excel
                    </Button>
                    <Button
                        variant="default"
                        disabled={!file || !!loading}
                        onClick={() => handleConvert('json')}
                    >
                        {loading === 'json' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Export to JSON
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
