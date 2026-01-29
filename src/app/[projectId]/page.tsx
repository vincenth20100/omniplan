'use client';
import { ProjectPage as ProjectPageComponent } from '@/components/project-page';
import { useUser } from '@/firebase';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProjectPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;
    const { user, isUserLoading } = useUser();

    useEffect(() => {
        // If auth state is resolved and there's no user, redirect to the login page.
        if (!isUserLoading && !user) {
            router.replace('/');
        }
    }, [isUserLoading, user, router]);
    
    // Show a loading/authenticating message while checking the user's status.
    if (isUserLoading || !user) {
        return (
             <div className="flex items-center justify-center h-screen bg-background">
                <p>Authenticating...</p>
            </div>
        );
    }
    
    if (!projectId) {
        // Handle cases where projectId is not available in the URL, though unlikely.
         return (
             <div className="flex items-center justify-center h-screen bg-background">
                <p>Loading Project...</p>
            </div>
        );
    }
    
    // Once authenticated and projectId is available, render the main project page.
    return <ProjectPageComponent user={user} projectId={projectId} />;
}
