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
import { useToast } from "@/hooks/use-toast";


export function ViewManager({ views, currentViewId, isDirty, dispatch, showTitle = true, isEditor }: { views: View[], currentViewId: string | null, isDirty?: boolean, dispatch: any, showTitle?: boolean, isEditor?: boolean }) {
    const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [newViewName, setNewViewName] = useState("");
    const { toast } = useToast();

    const currentView = views.find(v => v.id === currentViewId);

    const handleSetView = (viewId: string) => {
        // TODO: Could add a confirmation dialog here if `isDirty` is true
        dispatch({ type: 'SET_VIEW', payload: { viewId } });
    }

    const handleUpdateView = () => {
        if (currentViewId && currentViewId !== 'default') {
            dispatch({ type: 'UPDATE_CURRENT_VIEW' });
            toast({
                title: "View Saved",
                description: `The view "${currentView?.name}" has been updated.`,
            });
        } else {
            // If current view is default, "Save" should act like "Save As"
            setNewViewName(currentView ? `${currentView.name} - Copy` : "Custom View");
            setIsSaveAsOpen(true);
        }
    }

    const handleSaveAs = () => {
        if (newViewName.trim()) {
            dispatch({ type: 'SAVE_VIEW_AS', payload: { name: newViewName } });
            setIsSaveAsOpen(false);
            setNewViewName("");
            toast({
                title: "View Saved",
                description: `The new view "${newViewName}" has been created.`,
            });
        }
    }

    const handleDelete = () => {
        if (currentViewId) {
            dispatch({ type: 'DELETE_VIEW', payload: { viewId: currentViewId } });
            toast({
                title: "View Deleted",
                description: `The view "${currentView?.name}" has been deleted.`,
            });
            setIsDeleteConfirmOpen(false);
        }
    }

    const canDelete = !!currentViewId && currentViewId !== 'default' && !!isEditor;

    return (
        <div>
             {showTitle && <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">TABLE VIEW</h3>}
             <div className="p-1 flex flex-col gap-2">
                <Select value={currentViewId || ''} onValueChange={handleSetView}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a view...">
                             {currentView ? `${currentView.name}${isDirty ? '*' : ''}` : 'Custom'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {views.map(view => (
                            <SelectItem key={view.id} value={view.id}>{view.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={handleUpdateView} disabled={!isEditor}>
                        <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setNewViewName(currentView ? `${currentView.name} - Copy` : 'Custom View'); setIsSaveAsOpen(true); }} disabled={!isEditor}>
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
