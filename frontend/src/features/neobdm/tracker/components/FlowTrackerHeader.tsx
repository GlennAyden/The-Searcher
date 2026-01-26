'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type FlowTrackerHeaderProps = {
    symbol: string;
    availableTickers: string[];
    flowMetric: string;
    limit: number;
    onSymbolChange: (symbol: string) => void;
    onFlowMetricChange: (metric: string) => void;
    onLimitChange: (limit: number) => void;
};

export function FlowTrackerHeader({
    symbol,
    availableTickers,
    flowMetric,
    limit,
    onSymbolChange,
    onFlowMetricChange,
    onLimitChange
}: FlowTrackerHeaderProps) {
    const [searchInput, setSearchInput] = useState(symbol);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredTickers = useMemo(() => {
        const query = searchInput.toUpperCase();
        if (!query) return availableTickers;
        return availableTickers.filter(t => t.toUpperCase().includes(query));
    }, [availableTickers, searchInput]);

    useEffect(() => {
        setSearchInput(symbol);
    }, [symbol]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex items-center justify-between bg-[#181a1f] p-2 border-b border-zinc-800/60 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
            <div className="flex items-center gap-4">
                <Link href="/neobdm-summary" className="hover:bg-zinc-800 p-1 rounded-sm transition-colors group">
                    <ArrowLeft className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100" />
                </Link>
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <h1 className="text-[14px] font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                        NeoBDM Flow Tracker
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative" ref={dropdownRef}>
                    <div className="flex items-center gap-2 bg-[#23252b] px-2 py-1 rounded-sm border border-zinc-700/50 focus-within:border-blue-500/50 transition-all">
                        <Search className="w-3.5 h-3.5 text-zinc-500" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => {
                                setSearchInput(e.target.value.toUpperCase());
                                setIsDropdownOpen(true);
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            placeholder="CARI EMITEN..."
                            className="bg-transparent text-zinc-200 text-[10px] outline-none font-bold uppercase w-32 placeholder:text-zinc-600"
                        />
                    </div>

                    {isDropdownOpen && filteredTickers.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-[#181a1f] border border-zinc-700 rounded-sm shadow-2xl max-h-60 overflow-y-auto z-[60] scrollbar-thin scrollbar-thumb-zinc-700">
                            {filteredTickers.map(t => (
                                <button
                                    key={t}
                                    onClick={() => {
                                        onSymbolChange(t);
                                        setSearchInput(t);
                                        setIsDropdownOpen(false);
                                    }}
                                    className={cn(
                                        'w-full text-left px-3 py-2 text-[10px] font-bold transition-colors hover:bg-blue-500/10 hover:text-blue-400',
                                        symbol === t ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-400'
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-zinc-800 mx-1" />

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-[#23252b] px-2 py-1 rounded-sm border border-zinc-700/50">
                        <span className="text-[8px] text-zinc-500 font-bold uppercase">Metric:</span>
                        <select
                            value={flowMetric}
                            onChange={(e) => onFlowMetricChange(e.target.value)}
                            className="bg-transparent text-blue-400 font-bold text-[10px] outline-none cursor-pointer"
                        >
                            <option value="flow_d0">D-0 (Daily)</option>
                            <option value="flow_w1">W-1 (Weekly)</option>
                            <option value="flow_c3">C-3 (3 Days)</option>
                            <option value="flow_c5">C-5 (5 Days)</option>
                            <option value="flow_c10">C-10 (10 Days)</option>
                            <option value="flow_c20">C-20 (20 Days)</option>
                        </select>
                    </div>

                    <select
                        value={limit}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                        className="bg-[#23252b] border border-zinc-700/50 text-zinc-200 text-[10px] rounded-sm py-1 px-2 outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value={15}>15D</option>
                        <option value={30}>30D</option>
                        <option value={60}>60D</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
