'use client';
import { useUser, useFirestore } from '@/firebase';
import { LoginPage } from '@/components/login-page';
import { ProjectSelectionPage } from '@/components/project-selection-page';
import { useEffect } from 'react';
import { collection, doc, getDoc, setDoc, query, where, getDocs, writeBatch, arrayUnion } from 'firebase/firestore';

export default function Home() {
    const { user, isUserLoading, userError } = useUser();
    const firestore = useFirestore();

    useEffect(() => {
        if (user && firestore) {
            const userDocRef = doc(firestore, 'users', user.uid);
            getDoc(userDocRef).then(async (userDoc) => {
                if (!userDoc.exists()) {
                    // New user! Check for pending invitations
                    const invitationsQuery = query(collection(firestore, 'invitations'), where("email", "==", user.email));
                    const invitationsSnapshot = await getDocs(invitationsQuery);
                    
                    const batch = writeBatch(firestore);
                    const projectIdsForNewUser: string[] = [];
                    
                    invitationsSnapshot.forEach(invitationDoc => {
                        const invitation = invitationDoc.data();
                        projectIdsForNewUser.push(invitation.projectId);
                        
                        // Add user to the project's members subcollection
                        const memberDocRef = doc(firestore, 'projects', invitation.projectId, 'members', user.uid);
                        batch.set(memberDocRef, {
                            userId: user.uid,
                            role: invitation.role,
                            displayName: user.displayName || user.email,
                            photoURL: user.photoURL || '',
                        });
                        
                        // Add userId to project's memberIds array for rule checks
                        const projectDocRef = doc(firestore, 'projects', invitation.projectId);
                        batch.update(projectDocRef, {
                            memberIds: arrayUnion(user.uid)
                        });
                        
                        // Delete the invitation
                        batch.delete(invitationDoc.ref);
                    });

                    // Create the main user document
                    batch.set(userDocRef, { id: user.uid, projectIds: projectIdsForNewUser });
                    
                    await batch.commit();
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
