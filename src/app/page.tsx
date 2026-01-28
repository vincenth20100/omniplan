'use client';
import { useUser, useFirestore } from '@/firebase';
import { LoginPage } from '@/components/login-page';
import { ProjectSelectionPage } from '@/components/project-selection-page';
import { useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Home() {
    const { user, isUserLoading, userError } = useUser();
    const firestore = useFirestore();

    useEffect(() => {
        if (user && firestore) {
            const userDocRef = doc(firestore, 'users', user.uid);
            getDoc(userDocRef).then(userDoc => {
                if (!userDoc.exists()) {
                    setDoc(userDocRef, { id: user.uid, projectIds: [] }, { merge: true });
                }
            });
        }
    }, [user, firestore]);

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
