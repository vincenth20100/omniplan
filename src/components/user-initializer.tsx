'use client';

import { useUser, useFirestore } from '@/firebase';
import { useEffect, useState } from 'react';
import { doc, getDoc, query, collection, where, getDocs, writeBatch, arrayUnion, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export function UserInitializer({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        if (isUserLoading) return; // Wait for auth to settle

        if (!user || !firestore) {
            setIsInitializing(false);
            return;
        }

        const initUser = async () => {
            try {
                // Check for invitations and User Doc
                const userDocRef = doc(firestore, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);

                // Query invitations for this user's email
                const invitationsQuery = query(collection(firestore, 'invitations'), where("email", "==", user.email));
                const invitationsSnapshot = await getDocs(invitationsQuery);

                const batch = writeBatch(firestore);
                let batchHasOps = false;
                const newProjectIds: string[] = [];

                // Process Invitations
                invitationsSnapshot.forEach((invitationDoc) => {
                    const invitation = invitationDoc.data();
                    const projectId = invitation.projectId;

                    if (projectId) {
                        newProjectIds.push(projectId);

                         // Add user to project's members subcollection
                        const memberDocRef = doc(firestore, 'projects', projectId, 'members', user.uid);
                        batch.set(memberDocRef, {
                            userId: user.uid,
                            role: invitation.role || 'viewer',
                            displayName: user.displayName || user.email || 'User',
                            photoURL: user.photoURL || '',
                        });

                        // Add userId to project's memberIds array (for security rules)
                        const projectDocRef = doc(firestore, 'projects', projectId);
                        batch.update(projectDocRef, {
                            memberIds: arrayUnion(user.uid)
                        });
                    }

                    // Delete the invitation (consume it)
                    batch.delete(invitationDoc.ref);
                    batchHasOps = true;
                });

                // Update or Create User Doc
                if (!userDocSnap.exists()) {
                    // Create new user doc
                    batch.set(userDocRef, {
                        id: user.uid,
                        projectIds: newProjectIds
                    });
                    batchHasOps = true;
                } else if (newProjectIds.length > 0) {
                    // Update existing user doc with new project IDs
                     batch.update(userDocRef, {
                        projectIds: arrayUnion(...newProjectIds)
                    });
                    batchHasOps = true;
                }

                if (batchHasOps) {
                    await batch.commit();
                }
            } catch (err) {
                console.error("Error initializing user:", err);
            } finally {
                setIsInitializing(false);
            }
        };

        initUser();
    }, [user, isUserLoading, firestore]);

    // Show loading screen while checking/initializing user profile
    // Only block if we have a user (to allow login page to render if !user)
    if (user && isInitializing) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p className="text-muted-foreground">Setting up your workspace...</p>
            </div>
        );
    }

    return <>{children}</>;
}
