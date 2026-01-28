'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase";
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { GanttChartSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google: ", error);
            if (error instanceof FirebaseError) {
                // Don't show toast for user-cancelled popups
                if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
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
    
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast({
                variant: "destructive",
                title: "Missing fields",
                description: "Please enter both email and password.",
            });
            return;
        }
        setIsLoading(true);
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                toast({
                    title: "Account Created",
                    description: "You have been successfully signed up.",
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            if (error instanceof FirebaseError) {
                let description = "An unknown error occurred.";
                switch(error.code) {
                    case 'auth/user-not-found':
                        description = "No account found with this email. Please sign up first.";
                        break;
                    case 'auth/wrong-password':
                        description = "Incorrect password. Please try again.";
                        break;
                    case 'auth/email-already-in-use':
                        description = "This email is already in use. Please sign in.";
                        break;
                    case 'auth/weak-password':
                         description = "The password is too weak. It must be at least 6 characters long.";
                         break;
                    default:
                        description = error.message;
                }

                toast({
                    variant: "destructive",
                    title: isSignUp ? "Sign Up Failed" : "Sign In Failed",
                    description: description,
                });
            }
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background">
            <div className="flex items-center gap-4 mb-8">
                 <GanttChartSquare className="h-12 w-12 text-primary" />
                <h1 className="text-4xl font-bold font-headline">OmniPlan AI</h1>
            </div>
            <div className="w-full max-w-sm p-8 space-y-6 bg-card rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-center text-card-foreground">
                    {isSignUp ? 'Create an Account' : 'Sign In'}
                </h2>
                
                <form onSubmit={handleEmailAuth} className="space-y-4">
                    <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="user@example.com" />
                    </div>
                    <div>
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </Button>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                            Or continue with
                        </span>
                    </div>
                </div>

                <Button variant="outline" onClick={handleGoogleSignIn} className="w-full">
                    <GoogleIcon className="mr-2 h-4 w-4" />
                    Sign In with Google
                </Button>
                
                <p className="px-8 text-center text-sm text-muted-foreground">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <Button variant="link" className="p-0" onClick={() => setIsSignUp(!isSignUp)}>
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </Button>
                </p>
            </div>
        </div>
    );
}
