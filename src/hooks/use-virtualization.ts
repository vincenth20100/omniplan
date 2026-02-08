import { useState, useRef, useEffect } from 'react';

export function useVirtualization({
    count,
    scrollElement,
    estimateSize,
    overscan = 5,
    axis = 'y'
}: {
    count: number;
    scrollElement: HTMLElement | null;
    estimateSize: (index: number) => number;
    overscan?: number;
    axis?: 'x' | 'y';
}) {
    const [scrollOffset, setScrollOffset] = useState(0);
    const [viewportSize, setViewportSize] = useState(0);

    useEffect(() => {
        const element = scrollElement;
        if (!element) return;

        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    setScrollOffset(axis === 'y' ? element.scrollTop : element.scrollLeft);
                    ticking = false;
                });
                ticking = true;
            }
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
    }, [scrollElement, axis]);

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
