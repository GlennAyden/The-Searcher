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
    timeRange: '30d' | 'all';
    onTimeRangeChange: (value: '30d' | 'all') => void;
};

export function NewsLibraryFilters({
    sentimentFilter,
    sourceFilter,
    tickerFilter,
    onSentimentChange,
    onSourceChange,
    onTickerChange,
    timeRange,
    onTimeRangeChange
}: NewsLibraryFiltersProps) {
    return (
        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800 backdrop-blur-sm self-end">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-2">Range:</span>
                <div className="inline-flex rounded-lg border border-zinc-800 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => onTimeRangeChange('30d')}
                        className={`px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                            timeRange === '30d'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        30D
                    </button>
                    <button
                        type="button"
                        onClick={() => onTimeRangeChange('all')}
                        className={`px-2.5 py-1.5 text-[10px] font-bold transition-all border-l border-zinc-800 ${
                            timeRange === 'all'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        ALL
                    </button>
                </div>
            </div>

            <div className="w-px h-6 bg-zinc-800 mx-1" />

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
