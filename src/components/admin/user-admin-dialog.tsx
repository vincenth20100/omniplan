'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { collection, query, getDocs, doc, updateDoc, deleteDoc, where, collectionGroup, orderBy, limit, addDoc } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Search, Trash2, Ban, CheckCircle, Mail, Send, X } from "lucide-react";
import { PersistentLogList } from "@/components/history/persistent-log-list";
import { useUser } from "@/firebase";
import type { PersistentHistoryEntry } from "@/lib/types";

interface UserDoc {
    id: string;
    projectIds: string[];
    displayName?: string;
    email?: string;
    photoURL?: string;
    lastLogin?: any;
    status?: 'active' | 'paused' | 'invited';
}

interface Invitation {
    id: string;
    email: string;
    sentAt: any;
    invitedBy: string;
    projectId?: string;
}

interface UserAdminDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UserAdminDialog({ open, onOpenChange }: UserAdminDialogProps) {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [users, setUsers] = useState<UserDoc[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Invitations
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loadingInvitations, setLoadingInvitations] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);

    // Activity Logs
    const [activityLogs, setActivityLogs] = useState<PersistentHistoryEntry[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Fetch users and invitations when dialog opens
    useEffect(() => {
        if (open && firestore) {
            const fetchUsers = async () => {
                setLoading(true);
                try {
                    const q = query(collection(firestore, 'users'));
                    const snapshot = await getDocs(q);
                    const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserDoc));
                    setUsers(fetchedUsers);
                } catch (error) {
                    console.error("Error fetching users:", error instanceof Error ? error.message : error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Could not fetch users list. " + (error as Error).message
                    });
                } finally {
                    setLoading(false);
                }
            };

            const fetchInvitations = async () => {
                setLoadingInvitations(true);
                try {
                    const q = query(collection(firestore, 'invitations'));
                    const snapshot = await getDocs(q);
                    const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
                    setInvitations(fetched);
                } catch (error) {
                    console.error("Error fetching invitations:", error);
                    // Silent fail if permission denied (non-admin view?) but we are in admin dialog
                } finally {
                    setLoadingInvitations(false);
                }
            };

            fetchUsers();
            fetchInvitations();
        }
    }, [open, firestore, toast]);

    // Fetch logs when user is selected
    useEffect(() => {
        if (selectedUser && firestore) {
            const fetchLogs = async () => {
                setLoadingLogs(true);
                try {
                    // Collection Group Query
                    const q = query(
                        collectionGroup(firestore, 'history'),
                        where('userId', '==', selectedUser.id),
                        orderBy('timestamp', 'desc'),
                        limit(50)
                    );
                    const snapshot = await getDocs(q);
                    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PersistentHistoryEntry));
                    setActivityLogs(logs);
                } catch (error) {
                    console.error("Error fetching user activity:", error);
                    // Don't toast error here as it might be common if no logs or permissions weirdness (though we are admin)
                } finally {
                    setLoadingLogs(false);
                }
            };
            fetchLogs();
        } else {
            setActivityLogs([]);
        }
    }, [selectedUser, firestore]);

    const filteredUsers = users.filter(u =>
        (u.displayName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        u.id.includes(searchQuery)
    );

    const handlePauseUser = async () => {
        if (!selectedUser || !firestore) return;
        const newStatus = selectedUser.status === 'paused' ? 'active' : 'paused';
        try {
            await updateDoc(doc(firestore, 'users', selectedUser.id), { status: newStatus });
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u));
            setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
            toast({ title: `User ${newStatus === 'paused' ? 'paused' : 'activated'}` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update user status.' });
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser || !firestore) return;
        if (!confirm(`Are you sure you want to delete ${selectedUser.displayName || 'this user'}? This cannot be undone.`)) return;

        try {
            await deleteDoc(doc(firestore, 'users', selectedUser.id));
            setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
            setSelectedUser(null);
            toast({ title: 'User deleted' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete user.' });
        }
    };

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !firestore || !currentUser) return;

        setSendingInvite(true);
        try {
            const newInvite = {
                email: inviteEmail.trim().toLowerCase(),
                sentAt: new Date(),
                invitedBy: currentUser.uid,
                // Global invitation, no projectId
            };
            const docRef = await addDoc(collection(firestore, 'invitations'), newInvite);
            setInvitations(prev => [{ id: docRef.id, ...newInvite }, ...prev]);
            setInviteEmail('');
            toast({ title: 'Invitation sent', description: `Invite sent to ${newInvite.email}` });
        } catch (error) {
            console.error("Error sending invite:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not send invitation.' });
        } finally {
            setSendingInvite(false);
        }
    };

    const handleDeleteInvitation = async (id: string) => {
        if (!firestore) return;
        if (!confirm("Revoke this invitation?")) return;
        try {
            await deleteDoc(doc(firestore, 'invitations', id));
            setInvitations(prev => prev.filter(i => i.id !== id));
            toast({ title: 'Invitation revoked' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not revoke invitation.' });
        }
    };

    const userManagementContent = (
        <div className="flex h-full gap-4 mt-4">
            {/* User List */}
            <div className={`w-1/3 flex flex-col min-w-[250px] border-r pr-4 ${isMobile ? (selectedUser ? 'hidden' : 'w-full') : ''}`}>
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col gap-2">
                        {loading ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center text-muted-foreground p-4">No users found.</div>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                                        selectedUser?.id === user.id ? 'bg-secondary' : 'hover:bg-secondary/50'
                                    }`}
                                >
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={user.photoURL} />
                                        <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-medium truncate">{user.displayName || 'Unknown User'}</p>
                                        <p className="text-xs text-muted-foreground truncate">{user.email || user.id}</p>
                                    </div>
                                    {user.status === 'paused' && <Badge variant="destructive" className="h-2 w-2 rounded-full p-0" />}
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* User Details */}
            <div className={`flex-1 flex flex-col ${isMobile ? (selectedUser ? 'w-full' : 'hidden') : ''}`}>
                {selectedUser ? (
                    <>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                {isMobile && <Button variant="ghost" onClick={() => setSelectedUser(null)} className="mr-2">Back</Button>}
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={selectedUser.photoURL} />
                                    <AvatarFallback>{selectedUser.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-xl font-bold">{selectedUser.displayName || 'Unknown User'}</h2>
                                    <p className="text-muted-foreground">{selectedUser.email}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant={selectedUser.status === 'paused' ? "destructive" : "outline"}>
                                            {selectedUser.status || 'Active'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">ID: {selectedUser.id}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handlePauseUser}>
                                    {selectedUser.status === 'paused' ? <CheckCircle className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                                    {selectedUser.status === 'paused' ? 'Activate' : 'Pause'}
                                </Button>
                                <Button variant="destructive" size="sm" onClick={handleDeleteUser}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </div>
                        </div>

                        <Tabs defaultValue="projects" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList>
                                <TabsTrigger value="projects">Projects ({selectedUser.projectIds?.length || 0})</TabsTrigger>
                                <TabsTrigger value="activity">Activity Log</TabsTrigger>
                            </TabsList>
                            <TabsContent value="projects" className="flex-1 overflow-hidden mt-4">
                                <ScrollArea className="h-full">
                                    <div className="space-y-2 pr-4">
                                        {selectedUser.projectIds?.length > 0 ? (
                                            selectedUser.projectIds.map(pid => (
                                                <div key={pid} className="border p-3 rounded-md flex justify-between items-center">
                                                    <span className="font-medium">{pid}</span>
                                                    {/* Ideally we would fetch project names here, but for now ID is shown */}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-muted-foreground p-4 text-center">No projects joined.</div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="activity" className="flex-1 overflow-hidden mt-4 relative">
                                <ScrollArea className="h-full">
                                    {loadingLogs ? (
                                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                                    ) : (
                                        <PersistentLogList history={activityLogs} />
                                    )}
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a user to view details
                    </div>
                )}
            </div>
        </div>
    );

    const content = (
        <Tabs defaultValue="users" className="flex-1 flex flex-col overflow-hidden mt-4">
            <div className="flex justify-between items-center">
                <TabsList>
                    <TabsTrigger value="users">User List</TabsTrigger>
                    <TabsTrigger value="invitations">Invitations</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="users" className="flex-1 overflow-hidden">
                {userManagementContent}
            </TabsContent>

            <TabsContent value="invitations" className="flex-1 flex flex-col overflow-hidden">
                <div className="mb-6 p-4 border rounded-lg bg-secondary/20">
                    <h3 className="text-sm font-medium mb-2">Invite New User</h3>
                    <form onSubmit={handleInviteUser} className="flex gap-2">
                        <div className="relative flex-1">
                            <Mail className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="email"
                                placeholder="Enter email address"
                                className="pl-8"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={sendingInvite}>
                            {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                            Send Invitation
                        </Button>
                    </form>
                    <p className="text-xs text-muted-foreground mt-2">
                        Invited users will be automatically recognized when they sign in with this email.
                    </p>
                </div>

                <div className="flex-1 border rounded-md overflow-hidden flex flex-col">
                    <div className="p-3 border-b bg-muted/40 font-medium text-sm grid grid-cols-[1fr_auto_auto] gap-4">
                        <span>Email</span>
                        <span>Sent Date</span>
                        <span>Action</span>
                    </div>
                    <ScrollArea className="flex-1">
                        {loadingInvitations ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                        ) : invitations.length === 0 ? (
                            <div className="text-center text-muted-foreground p-8">No pending invitations.</div>
                        ) : (
                            <div className="divide-y">
                                {invitations.map(invite => (
                                    <div key={invite.id} className="p-3 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                                        <span className="font-medium">{invite.email}</span>
                                        <span className="text-sm text-muted-foreground">
                                            {invite.sentAt?.toDate ? invite.sentAt.toDate().toLocaleDateString() : 'Just now'}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteInvitation(invite.id)}
                                            title="Revoke Invitation"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </TabsContent>
        </Tabs>
    );

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="bottom" className="h-[90vh] flex flex-col">
                    <SheetHeader>
                        <SheetTitle>User Administration</SheetTitle>
                    </SheetHeader>
                    {content}
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>User Administration</DialogTitle>
                    <DialogDescription>Manage users, view activity, and control access.</DialogDescription>
                </DialogHeader>
                {content}
            </DialogContent>
        </Dialog>
    );
}
