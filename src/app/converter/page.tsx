'use client';

import { apiPath } from '@/lib/api-path';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Upload, CheckCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/providers/auth-provider";

export default function ConverterPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccess(null);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const token = user?.token ?? '';

            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(apiPath('/api/import'), {
                method: 'POST',
                body: formData,
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: 'Import failed' }));
                throw new Error(body.error ?? `Server error ${res.status}`);
            }

            const { projectId } = await res.json();
            setSuccess(`Project imported successfully (id: ${projectId})`);

            // Redirect to the newly created project
            router.push(`/${projectId}`);
        } catch (err) {
            console.error(err);
            setError((err as Error).message || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container max-w-2xl mx-auto py-10 px-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Import Project File</CardTitle>
                    <CardDescription>
                        Upload a project file (.mpp, .xer, .xml, .xlsx, etc.) to import it into OmniPlan.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Input
                            id="file"
                            type="file"
                            accept=".mpp,.mpt,.mpx,.xer,.pmxml,.xml,.xlsx,.csv,.pp,.pod,.planner,.gan,.sdef,.fts"
                            onChange={handleFileChange}
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                            {file ? `Selected: ${file.name}` : "Select a project file to begin"}
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
                <CardFooter className="flex justify-end">
                    <Button
                        variant="default"
                        disabled={!file || loading}
                        onClick={handleImport}
                    >
                        {loading
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <Upload className="mr-2 h-4 w-4" />}
                        Import Project
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
