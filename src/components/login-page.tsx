'use client';

import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { GanttChartSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
    const { login } = useAuth();
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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

            </div>
        </div>
    );
}
