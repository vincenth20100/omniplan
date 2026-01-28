'use client';
import { ProjectPage as ProjectPageComponent } from '@/components/project-page';
import { useUser } from '@/firebase';

export default function ProjectPage({ params }: { params: { projectId: string } }) {
    const { user, isUserLoading } = useUser();
    
    if (isUserLoading) {
        return (
             <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        );
    }
    
    if (!user) {
        // This can happen briefly on first load or if auth state is lost.
        // The main page logic should handle redirects for unauthenticated users.
        return (
             <div className="flex items-center justify-center h-screen">
                <p>Authenticating...</p>
            </div>
        );
    }
    
    return <ProjectPageComponent user={user} projectId={params.projectId} />;
}
