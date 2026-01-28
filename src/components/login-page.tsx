'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase";
import { signInAnonymously, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { GanttChartSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" {...props}>
        <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.86 2.25-4.82 2.25-3.64 0-6.55-3-6.55-6.6s2.91-6.6 6.55-6.6c1.98 0 3.36.79 4.34 1.73l2.4-2.38C17.44 3.4 15.22 2.25 12.48 2.25c-5.4 0-9.84 4.4-9.84 9.9s4.44 9.9 9.84 9.9c5.22 0 9.4-3.5 9.4-9.56 0-.64-.07-1.25-.16-1.84H12.48z"
        />
    </svg>
);

export function LoginPage() {
    const auth = useAuth();
    const { toast } = useToast();

    const handleAnonymousSignIn = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Error signing in anonymously: ", error);
            if (error instanceof FirebaseError) {
                let description = error.message;
                if (error.code === 'auth/operation-not-allowed') {
                    description = "Anonymous sign-in is not enabled. Please enable it in your Firebase project's Authentication settings.";
                }
                 toast({
                    variant: "destructive",
                    title: "Guest Sign-In Failed",
                    description: description,
                });
            }
        }
    };

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google: ", error);
            if (error instanceof FirebaseError) {
                // Don't show toast for user-cancelled popups
                if (error.code === 'auth/popup-closed-by-user') {
                    return;
                }
                
                let description = error.message;
                if (error.code === 'auth/operation-not-allowed') {
                    description = "Google Sign-In is not enabled. Please enable it in your Firebase project's Authentication settings and ensure your domain is authorized.";
                }
                
                toast({
                    variant: "destructive",
                    title: "Google Sign-In Failed",
                    description: description,
                });
            } else {
                 toast({
                    variant: "destructive",
                    title: "An unexpected error occurred",
                    description: "Please try again.",
                });
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <div className="flex items-center gap-4 mb-8">
                 <GanttChartSquare className="h-12 w-12 text-primary" />
                <h1 className="text-4xl font-bold font-headline">OmniPlan AI</h1>
            </div>
            <div className="w-full max-w-sm p-8 space-y-4 bg-card rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-center text-card-foreground">
                    Sign In
                </h2>
                <Button onClick={handleGoogleSignIn} className="w-full" variant="outline">
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    Sign In with Google
                </Button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                        Or
                        </span>
                    </div>
                </div>
                <Button onClick={handleAnonymousSignIn} className="w-full" variant="secondary">
                    Continue as Guest
                </Button>
                <p className="text-xs text-center text-muted-foreground px-4">
                   Guest data is temporary and stored only on this device. Sign in with Google to sync across devices.
                </p>
            </div>
        </div>
    );
}
