'use client';
import { useUser, useFirestore } from '@/firebase';
import { LoginPage } from '@/components/login-page';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initialTasks, initialLinks, initialResources, initialAssignments, initialCalendars } from '@/lib/mock-data';

// Component to handle project loading and creation
function ProjectLoader({ user }: { user: any }) {
    const firestore = useFirestore();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('Setting up your workspace...');

    useEffect(() => {
        const findOrCreateProject = async () => {
            const userDocRef = doc(firestore, 'users', user.uid);
            try {
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists() && userDoc.data().projectIds?.length > 0) {
                    setMessage('Loading your project...');
                    const projectId = userDoc.data().projectIds[0];
                    router.replace(`/${projectId}`);
                } else {
                    setMessage('Creating your first project...');
                    const newProjectId = `proj-${Date.now()}`;
                    const batch = writeBatch(firestore);

                    // 1. Create the project document
                    const projectDocRef = doc(firestore, 'projects', newProjectId);
                    batch.set(projectDocRef, {
                        id: newProjectId,
                        name: 'My First Project',
                        ownerId: user.uid,
                        createdAt: new Date(),
                        memberIds: [user.uid]
                    });

                    // 2. Add user as the owner in the members subcollection
                    const memberDocRef = doc(firestore, 'projects', newProjectId, 'members', user.uid);
                    batch.set(memberDocRef, {
                        userId: user.uid,
                        role: 'owner',
                        displayName: user.displayName || 'User',
                        photoURL: user.photoURL || '',
                    });

                    // 3. Update the user's document with the new project ID
                    batch.set(userDocRef, { id: user.uid, projectIds: [newProjectId] }, { merge: true });
                    
                    // 4. Seed project with initial data
                    initialTasks.forEach((task, index) => {
                        const docRef = doc(firestore, 'projects', newProjectId, 'tasks', task.id);
                        batch.set(docRef, { ...task, order: index });
                    });
                    initialLinks.forEach(link => {
                        const docRef = doc(firestore, 'projects', newProjectId, 'links', link.id);
                        batch.set(docRef, link);
                    });
                    initialResources.forEach(resource => {
                        const docRef = doc(firestore, 'projects', newProjectId, 'resources', resource.id);
                        batch.set(docRef, resource);
                    });
                    initialAssignments.forEach(assignment => {
                        const docRef = doc(firestore, 'projects', newProjectId, 'assignments', assignment.id);
                        batch.set(docRef, assignment);
                    });
                    initialCalendars.forEach(calendar => {
                        const docRef = doc(firestore, 'projects', newProjectId, 'calendars', calendar.id);
                        batch.set(docRef, calendar);
                    });

                    await batch.commit();

                    // 5. Redirect to the newly created project
                    router.replace(`/${newProjectId}`);
                }
            } catch (error) {
                console.error("Error setting up project:", error);
                setMessage("There was an error setting up your workspace. Please try again.");
            }
        };

        if (user && firestore) {
            findOrCreateProject();
        }
    }, [user, firestore, router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <p>{message}</p>
        </div>
    );
}

export default function Home() {
    const { user, isUserLoading, userError } = useUser();

    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Loading...</p>
            </div>
        )
    }

    if (userError || !user) {
        return <LoginPage />
    }

    return <ProjectLoader user={user} />;
}
