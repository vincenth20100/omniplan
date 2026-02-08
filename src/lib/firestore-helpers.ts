import {
    type Firestore,
    query,
    collection,
    where,
    documentId,
    getDocs,
    getDoc,
    doc
} from 'firebase/firestore';
import type { Project } from '@/lib/types';

/**
 * Fetches multiple project documents by ID.
 * Optimizes fetching by using `in` queries (batches of 30).
 * Falls back to individual `getDoc` calls if a batch query fails (e.g. due to permissions).
 */
export async function fetchProjectsByIds(firestore: Firestore, ids: string[]): Promise<Project[]> {
    if (!ids || ids.length === 0) return [];

    // Deduplicate IDs
    const uniqueIds = Array.from(new Set(ids));
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += 30) {
        chunks.push(uniqueIds.slice(i, i + 30));
    }

    const results: Project[] = [];

    for (const chunk of chunks) {
        try {
            // Attempt batch fetch
            const q = query(collection(firestore, 'projects'), where(documentId(), 'in', chunk));
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                // Determine if ID needs to be injected manually or is part of data.
                // Project type usually expects 'id' field.
                const data = docSnap.data();
                results.push({ ...data, id: docSnap.id } as Project);
            });
        } catch (error) {
            console.warn("Batch fetch failed, falling back to individual fetching:", error);

            // Fallback: Fetch individually (handling potential permission errors gracefully)
            const promises = chunk.map(id => getDoc(doc(firestore, 'projects', id)));
            const outcomes = await Promise.allSettled(promises);

            outcomes.forEach(outcome => {
                if (outcome.status === 'fulfilled' && outcome.value.exists()) {
                    const data = outcome.value.data();
                    results.push({ ...data, id: outcome.value.id } as Project);
                } else if (outcome.status === 'rejected') {
                    // Log error but don't stop processing other items
                     console.warn("Failed to fetch individual project:", outcome.reason);
                }
            });
        }
    }

    return results;
}
