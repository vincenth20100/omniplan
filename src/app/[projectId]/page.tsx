'use client';
import { ProjectPage as ProjectPageComponent } from '@/components/project-page';
import { useUser } from '@/firebase';
import { useParams } from 'next/navigation';

export default function ProjectPage() {
    const params = useParams();
    const projectId = params.projectId as string;
    const { user, isUserLoading } = useUser();
    
    if (isUserLoading || !projectId) {
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
    
    return <ProjectPageComponent user={user} projectId={projectId} />;
}
