import { useState, useRef, useEffect, useCallback } from 'react';

export function useVirtualization({
    count,
    getScrollElement,
    estimateSize,
    overscan = 5
}: {
    count: number;
    getScrollElement: () => HTMLElement | null;
    estimateSize: (index: number) => number;
    overscan?: number;
}) {
    const [scrollOffset, setScrollOffset] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);

    // Using a ref to track if we've already attached listeners to a specific element
    const elementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const element = getScrollElement();
        if (!element) return;

        // If element changed, update ref
        elementRef.current = element;

        const handleScroll = () => {
            // We use requestAnimationFrame to throttle scroll updates if needed,
            // but React state updates are often batched enough.
            // For now, direct update.
            setScrollOffset(element.scrollTop);
        };

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setViewportHeight(entry.contentRect.height);
            }
        });

        element.addEventListener('scroll', handleScroll, { passive: true });
        resizeObserver.observe(element);

        // Initial values
        setScrollOffset(element.scrollTop);
        setViewportHeight(element.clientHeight);

        return () => {
            element.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, [getScrollElement]);

    // Calculate visible range
    // Assuming fixed height for now as per project requirements (DENSITY_SETTINGS)
    const itemHeight = estimateSize(0);
    const totalSize = count * itemHeight;

    let startIndex = Math.floor(scrollOffset / itemHeight);
    let endIndex = Math.ceil((scrollOffset + viewportHeight) / itemHeight);

    // Add overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(count - 1, endIndex + overscan);

    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
        virtualItems.push({
            index: i,
            start: i * itemHeight,
            size: itemHeight
        });
    }

    const startOffset = startIndex * itemHeight;
    const endOffset = Math.max(0, totalSize - (endIndex + 1) * itemHeight);

    return {
        virtualItems,
        totalSize,
        startOffset,
        endOffset,
        isScrolling: false // Placeholder for future enhancement
    };
}
