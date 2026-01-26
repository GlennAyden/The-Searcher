'use client';

import React from 'react';

type HighlightedTextProps = {
    text: string;
    positions: number[][];
};

export function HighlightedText({ text, positions }: HighlightedTextProps) {
    if (!positions || positions.length === 0) {
        return <span>{text}</span>;
    }

    const sortedPositions = [...positions].sort((a, b) => a[0] - b[0]);

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    sortedPositions.forEach(([start, end], idx) => {
        if (start > lastEnd) {
            parts.push(<span key={`text-${idx}`}>{text.slice(lastEnd, start)}</span>);
        }
        parts.push(
            <mark
                key={`highlight-${idx}`}
                className="bg-yellow-500/40 text-yellow-200 px-0.5 rounded font-semibold"
            >
                {text.slice(start, end)}
            </mark>
        );
        lastEnd = end;
    });

    if (lastEnd < text.length) {
        parts.push(<span key="text-end">{text.slice(lastEnd)}</span>);
    }

    return <>{parts}</>;
}
