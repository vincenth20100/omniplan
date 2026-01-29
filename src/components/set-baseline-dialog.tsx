'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function SetBaselineDialog({
    open,
    onOpenChange,
    onSave,
} : {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onSave: (name: string) => void,
}) {
    const [name, setName] = useState('');

    useEffect(() => {
        if (open) {
            // Suggest a default name when opening the dialog
            setName(`Baseline - ${format(new Date(), 'MMM d, yyyy')}`);
        }
    }, [open]);

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" onKeyDown={handleKeyDown}>
                <DialogHeader>
                    <DialogTitle>Set Baseline</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input 
                            id="name" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="col-span-3"
                            autoFocus
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleSave} disabled={!name.trim()}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
