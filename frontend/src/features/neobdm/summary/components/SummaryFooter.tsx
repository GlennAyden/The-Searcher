'use client';

import React from 'react';
import { AlertCircle, Download } from 'lucide-react';

type SummaryFooterProps = {
    paginatedCount: number;
    totalCount: number;
    error: string | null;
    currentPage: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
};

export function SummaryFooter({
    paginatedCount,
    totalCount,
    error,
    currentPage,
    totalPages,
    onPrev,
    onNext
}: SummaryFooterProps) {
    return (
        <div className="bg-[#181a1f] border-t border-zinc-800 px-2 py-0.5 text-[9px] text-zinc-500 flex justify-between items-center select-none h-[28px]">
            <div className="flex gap-4 items-center">
                <span>Showing {paginatedCount} of {totalCount} rows</span>
                {error && <span className="text-red-500 flex items-center gap-1 font-bold"><AlertCircle className="w-3 h-3" /> {error}</span>}
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={onPrev}
                    disabled={currentPage === 1}
                    className="px-1.5 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 text-[8px]"
                >
                    Prev
                </button>
                <span className="text-zinc-400 text-[8px] mx-1">Page {currentPage} of {totalPages || 1}</span>
                <button
                    onClick={onNext}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-1.5 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 text-[8px]"
                >
                    Next
                </button>
            </div>

            <div className="flex gap-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer text-[8px]">
                <span className="flex items-center gap-1"><Download className="w-2.5 h-2.5" /> Export CSV</span>
            </div>
        </div>
    );
}
