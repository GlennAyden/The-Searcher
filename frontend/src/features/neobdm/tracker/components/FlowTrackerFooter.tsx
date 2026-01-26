'use client';

import React from 'react';
import { History as HistoryIcon, Info as InfoIcon } from 'lucide-react';

export function FlowTrackerFooter() {
    return (
        <div className="bg-[#181a1f] border-t border-zinc-800 px-4 py-1 text-[9px] text-zinc-500 flex justify-between items-center h-[30px]">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><InfoIcon className="w-3 h-3" /> Data Flow diukur dalam <span className="text-blue-400 font-bold">Miliar IDR</span>.</span>
                <span className="flex items-center gap-1"><HistoryIcon className="w-3 h-3" /> [D] = Hari, [W] = Minggu, [C] = Kumulatif (Hari).</span>
            </div>
            <div className="flex gap-4 font-bold">
                <span className="text-pink-500 uppercase tracking-tighter">Pink Markers indicate Potential High Intensity Accumulation</span>
            </div>
        </div>
    );
}
