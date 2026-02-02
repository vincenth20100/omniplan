'use client';
import { Button } from "@/components/ui/button";
import { Columns3 } from "lucide-react";
import { ColumnPanel } from "@/components/view-options/column-panel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ColumnSpec } from "@/lib/types";
import { useState } from "react";

export function ColumnSelector({
    visibleColumns,
    columns,
    dispatch,
    disabled,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    disabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [dimensions, setDimensions] = useState({ width: 320, height: 400 });

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = dimensions.width;
        const startHeight = dimensions.height;

        const onMouseMove = (e: MouseEvent) => {
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            setDimensions({
                width: Math.max(300, newWidth),
                height: Math.max(300, newHeight)
            });
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Select Visible Columns" disabled={disabled}>
                    <Columns3 className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-4 relative"
                align="end"
                style={{ width: dimensions.width, height: dimensions.height }}
            >
                <ColumnPanel
                    visibleColumns={visibleColumns}
                    columns={columns}
                    dispatch={dispatch}
                    onCancel={() => setIsOpen(false)}
                />
                <div
                    onMouseDown={handleMouseDown}
                    className="absolute bottom-1 right-1 cursor-nwse-resize opacity-50 hover:opacity-100 touch-none p-1"
                    title="Resize"
                >
                     <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 15a2 2 0 0 1-2 2H15" />
                        <path d="M21 12v3" opacity="0"/>
                         {/* Simple corner indicator */}
                         <polyline points="16 22 22 22 22 16" />
                    </svg>
                </div>
            </PopoverContent>
        </Popover>
    );
}
