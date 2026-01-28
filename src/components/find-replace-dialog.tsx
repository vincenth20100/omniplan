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

export function FindReplaceDialog({
    open,
    onOpenChange,
    onFindReplace,
} : {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onFindReplace: (find: string, replace: string) => void,
}) {
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');

    useEffect(() => {
        if (!open) {
            // Optional: Reset state when dialog closes
            // setFindText('');
            // setReplaceText('');
        }
    }, [open]);

    const handleReplace = () => {
        if (findText) {
            onFindReplace(findText, replaceText);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleReplace();
      }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" onKeyDown={handleKeyDown}>
                <DialogHeader>
                    <DialogTitle>Find and Replace</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="find" className="text-right">Find</Label>
                        <Input 
                            id="find" 
                            value={findText} 
                            onChange={e => setFindText(e.target.value)} 
                            className="col-span-3"
                            autoFocus
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="replace" className="text-right">Replace</Label>
                        <Input 
                            id="replace" 
                            value={replaceText} 
                            onChange={e => setReplaceText(e.target.value)} 
                            className="col-span-3" 
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" onClick={handleReplace} disabled={!findText}>Replace All</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
