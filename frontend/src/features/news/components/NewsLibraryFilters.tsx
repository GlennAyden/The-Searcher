'use client';

import React from 'react';
import { Search } from 'lucide-react';

type NewsLibraryFiltersProps = {
    sentimentFilter: string;
    sourceFilter: string;
    tickerFilter: string;
    onSentimentChange: (value: string) => void;
    onSourceChange: (value: string) => void;
    onTickerChange: (value: string) => void;
};

export function NewsLibraryFilters({
    sentimentFilter,
    sourceFilter,
    tickerFilter,
    onSentimentChange,
    onSourceChange,
    onTickerChange
}: NewsLibraryFiltersProps) {
    return (
        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800 backdrop-blur-sm self-end">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-2">Filter Ticker:</span>
                <div className="relative">
                    <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={tickerFilter}
                        onChange={(e) => onTickerChange(e.target.value)}
                        placeholder="Search ticker..."
                        className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg py-1.5 pl-7 pr-3 focus:ring-1 focus:ring-blue-500 outline-none w-[140px] placeholder:text-zinc-600"
                    />
                </div>
            </div>

            <div className="w-px h-6 bg-zinc-800 mx-1" />

            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-2">Source:</span>
                <select
                    value={sourceFilter}
                    onChange={(e) => onSourceChange(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none w-[120px]"
                >
                    <option value="All">All Sources</option>
                    <option value="CNBC">CNBC</option>
                    <option value="EmitenNews">EmitenNews</option>
                    <option value="IDX">IDX</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-2">Sentiment:</span>
                <select
                    value={sentimentFilter}
                    onChange={(e) => onSentimentChange(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none w-[150px]"
                >
                    <option value="All">All Sentiments</option>
                    <option value="Bullish Only">Bullish Only</option>
                    <option value="Bearish Only">Bearish Only</option>
                    <option value="Netral Only">Netral Only</option>
                </select>
            </div>
        </div>
    );
}
