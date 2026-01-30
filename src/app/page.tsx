'use client';
import { useUser } from '@/firebase';
import { LoginPage } from '@/components/login-page';
import { ProjectSelectionPage } from '@/components/project-selection-page';

export default function Home() {
    const { user, isUserLoading, userError } = useUser();

    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <p>Loading...</p>
            </div>
        )
    }

    if (userError || !user) {
        return <LoginPage />
    }

    return <ProjectSelectionPage user={user} />;
}
