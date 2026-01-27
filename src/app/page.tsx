'use client';
import { useUser } from '@/firebase';
import { ProjectPage } from '@/components/project-page';
import { LoginPage } from '@/components/login-page';

export default function Home() {
    const { user, isUserLoading, userError } = useUser();

    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        )
    }

    if (!user) {
        return <LoginPage />
    }

    return <ProjectPage user={user} />;
}
