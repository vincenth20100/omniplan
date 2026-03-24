'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { ProjectMember } from '@/lib/types';
import type { AppUser } from '@/types/auth';

export function ProjectMembers({ projectId, user }: { projectId: string, user: AppUser }) {
    // TODO(T5): implement via API
    const members: ProjectMember[] = [];
    const otherMembers = members?.filter(m => m.userId !== user.id);

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
