'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase";
import { signInAnonymously } from "firebase/auth";
import { GanttChartSquare } from "lucide-react";

export function LoginPage() {
    const auth = useAuth();

    const handleAnonymousSignIn = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Error signing in anonymously: ", error);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <div className="flex items-center gap-4 mb-8">
                 <GanttChartSquare className="h-12 w-12 text-primary" />
                <h1 className="text-4xl font-bold font-headline">OmniPlan AI</h1>
            </div>
            <div className="w-full max-w-xs p-8 space-y-6 bg-card rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-center text-card-foreground">
                    Sign In
                </h2>
                <Button onClick={handleAnonymousSignIn} className="w-full">
                    Enter Project
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                    You are signing in anonymously.
                </p>
            </div>
        </div>
    );
}
