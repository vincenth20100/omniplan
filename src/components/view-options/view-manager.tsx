'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, CopyPlus, Trash2 } from "lucide-react";
import type { View } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export function ViewManager({ views, currentViewId, dispatch }: { views: View[], currentViewId: string | null, dispatch: any }) {
    const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [newViewName, setNewViewName] = useState("");

    const currentView = views.find(v => v.id === currentViewId);

    const handleSetView = (viewId: string) => {
        if (viewId === 'custom') return;
        dispatch({ type: 'SET_VIEW', payload: { viewId } });
    }

    const handleUpdateView = () => {
        if (currentViewId && currentViewId !== 'default') {
            dispatch({ type: 'UPDATE_CURRENT_VIEW' });
        } else {
            // If current view is a custom one or default, "Save" should act like "Save As"
            setIsSaveAsOpen(true);
        }
    }

    const handleSaveAs = () => {
        if (newViewName.trim()) {
            dispatch({ type: 'SAVE_VIEW_AS', payload: { name: newViewName } });
            setIsSaveAsOpen(false);
            setNewViewName("");
        }
    }

    const handleDelete = () => {
        if (currentViewId) {
            dispatch({ type: 'DELETE_VIEW', payload: { viewId: currentViewId } });
            setIsDeleteConfirmOpen(false);
        }
    }

    const canUpdate = !!currentViewId && currentViewId !== 'default';
    const canDelete = !!currentViewId && currentViewId !== 'default';

    return (
        <div>
             <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">TABLE VIEW</h3>
             <div className="p-1 flex flex-col gap-2">
                <Select value={currentViewId || 'custom'} onValueChange={handleSetView}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a view..." />
                    </SelectTrigger>
                    <SelectContent>
                        {views.map(view => (
                            <SelectItem key={view.id} value={view.id}>{view.name}</SelectItem>
                        ))}
                        {!currentView && <SelectItem value="custom" disabled>Custom View</SelectItem>}
                    </SelectContent>
                </Select>
                <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={handleUpdateView} disabled={!canUpdate}>
                        <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setNewViewName(''); setIsSaveAsOpen(true); }}>
                        <CopyPlus className="h-4 w-4 mr-2" /> Save As
                    </Button>
                     <Button variant="ghost" size="sm" onClick={() => setIsDeleteConfirmOpen(true)} disabled={!canDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Dialog open={isSaveAsOpen} onOpenChange={setIsSaveAsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save View As</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="view-name">View Name</Label>
                        <Input id="view-name" value={newViewName} onChange={e => setNewViewName(e.target.value)} autoFocus />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSaveAs} disabled={!newViewName.trim()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This will permanently delete the view "{currentView?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
