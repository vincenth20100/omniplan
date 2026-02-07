'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useIsAdmin(user: User | null | undefined) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const firestore = useFirestore();

    useEffect(() => {
        let isMounted = true;

        const checkAdmin = async () => {
            if (!user) {
                if (isMounted) {
                    setIsAdmin(false);
                    setIsLoading(false);
                }
                return;
            }

            setIsLoading(true);

            try {
                // 1. Check custom claim (and hardcoded email)
                // Force token refresh to get latest claims
                const idTokenResult = await user.getIdTokenResult(true);
                const claims = idTokenResult.claims;

                // Check if admin claim is present and truthy (boolean, string 'true', number 1)
                const hasAdminClaim =
                    claims.admin === true ||
                    claims.admin === 'true' ||
                    claims.admin === 1 ||
                    claims.admin === '1';

                const isHardcodedAdmin = user.email === 'vincent.heloin@gmail.com';

                if (hasAdminClaim || isHardcodedAdmin) {
                    if (isMounted) {
                        setIsAdmin(true);
                        setIsLoading(false);
                    }
                    return;
                }

                // 2. Check system/permissions document
                // This is now readable by authenticated users thanks to updated rules
                if (firestore && user.email) {
                    try {
                        const permissionsDocRef = doc(firestore, 'system', 'permissions');
                        const permissionsDoc = await getDoc(permissionsDocRef);

                        if (permissionsDoc.exists()) {
                            const data = permissionsDoc.data();
                            const admins = data.admins;

                            if (Array.isArray(admins) && admins.some((e: any) => typeof e === 'string' && e.toLowerCase() === user.email!.toLowerCase())) {
                                if (isMounted) {
                                    setIsAdmin(true);
                                    setIsLoading(false);
                                }
                                return;
                            }
                        }
                    } catch (error) {
                        console.warn("Failed to check system/permissions for admin status:", error);
                        // Fall through to false
                    }
                }

                if (isMounted) {
                    setIsAdmin(false);
                    setIsLoading(false);
                }

            } catch (error) {
                console.error("Error checking admin status:", error);
                if (isMounted) {
                    setIsAdmin(false); // Default to false on error
                    setIsLoading(false);
                }
            }
        };

        checkAdmin();

        return () => {
            isMounted = false;
        };
    }, [user, firestore]);

    return { isAdmin, isLoading };
}
