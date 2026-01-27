'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { GanttChartSquare } from "lucide-react";

export function LoginPage() {
    const auth = useAuth();

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google: ", error);
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
                <Button onClick={handleGoogleSignIn} className="w-full">
                    Sign in with Google
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                    More sign-in options coming soon.
                </p>
            </div>
        </div>
    );
}
