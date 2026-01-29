'use client';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, type Firestore } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { ProjectMember } from '@/lib/types';
import type { User } from 'firebase/auth';
    
export function ProjectMembers({ projectId, firestore, user }: { projectId: string, firestore: Firestore, user: User }) {
    const membersQuery = useMemoFirebase(() => projectId ? collection(firestore, 'projects', projectId, 'members') : null, [firestore, projectId]);
    const { data: members } = useCollection<ProjectMember>(membersQuery);

    const otherMembers = members?.filter(m => m.userId !== user.uid);

    if (!otherMembers || otherMembers.length === 0) {
        return null;
    }

    return (
        <TooltipProvider>
            <div className="flex items-center -space-x-2">
                {otherMembers.map(member => (
                    <Tooltip key={member.userId}>
                        <TooltipTrigger asChild>
                            <Avatar className="h-8 w-8 border-2 border-background">
                                <AvatarImage src={member.photoURL} alt={member.displayName} />
                                <AvatarFallback>{member.displayName?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{member.displayName}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    )
}
