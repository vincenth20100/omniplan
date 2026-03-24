'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
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
    const { login } = useAuth();
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // TODO (T5): Google OAuth via PocketBase — replace with pb.collection('users').authWithOAuth2()
    const handleGoogleSignIn = async () => {
        toast({
            variant: "destructive",
            title: "Google Sign-In Not Yet Available",
            description: "Google OAuth is being migrated to PocketBase.",
        });
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
            await login(email, password);
        } catch (error) {
            let description = "An unknown error occurred.";
            if (error instanceof Error) {
                description = error.message;
            }
            toast({
                variant: "destructive",
                title: "Sign In Failed",
                description,
            });
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
                    Sign In
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
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Sign In'}
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
            </div>
        </div>
    );
}
