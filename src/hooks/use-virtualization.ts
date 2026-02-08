import { useState, useRef, useEffect } from 'react';

export function useVirtualization({
    count,
    getScrollElement,
    estimateSize,
    overscan = 5,
    axis = 'y'
}: {
    count: number;
    getScrollElement: () => HTMLElement | null;
    estimateSize: (index: number) => number;
    overscan?: number;
    axis?: 'x' | 'y';
}) {
    const [scrollOffset, setScrollOffset] = useState(0);
    const [viewportSize, setViewportSize] = useState(0);

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
            setScrollOffset(axis === 'y' ? element.scrollTop : element.scrollLeft);
        };

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setViewportSize(axis === 'y' ? entry.contentRect.height : entry.contentRect.width);
            }
        });

        element.addEventListener('scroll', handleScroll, { passive: true });
        resizeObserver.observe(element);

        // Initial values
        setScrollOffset(axis === 'y' ? element.scrollTop : element.scrollLeft);
        setViewportSize(axis === 'y' ? element.clientHeight : element.clientWidth);

        return () => {
            element.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, [getScrollElement, axis]);

    // Calculate visible range
    // Assuming fixed height for now as per project requirements (DENSITY_SETTINGS)
    const itemSize = estimateSize(0);
    const totalSize = count * itemSize;

    let startIndex = Math.floor(scrollOffset / itemSize);
    let endIndex = Math.ceil((scrollOffset + viewportSize) / itemSize);

    // Add overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(count - 1, endIndex + overscan);

    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
        virtualItems.push({
            index: i,
            start: i * itemSize,
            size: itemSize
        });
    }

    const startOffset = startIndex * itemSize;
    const endOffset = Math.max(0, totalSize - (endIndex + 1) * itemSize);

    return {
        virtualItems,
        totalSize,
        startOffset,
        endOffset,
        isScrolling: false // Placeholder for future enhancement
    };
}
