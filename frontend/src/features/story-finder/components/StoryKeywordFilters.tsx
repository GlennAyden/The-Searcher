'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KeywordInfo } from '../types';

type StoryKeywordFiltersProps = {
    keywords: KeywordInfo[];
    selectedKeywords: string[];
    keywordStats: Record<string, number>;
    customKeyword: string;
    onToggleKeyword: (keyword: string) => void;
    onCustomKeywordChange: (value: string) => void;
    onAddCustomKeyword: () => void;
    ticker: string;
    onTickerChange: (value: string) => void;
    timeRange: '30d' | 'all';
    onTimeRangeChange: (value: '30d' | 'all') => void;
};

export function StoryKeywordFilters({
    keywords,
    selectedKeywords,
    keywordStats,
    customKeyword,
    onToggleKeyword,
    onCustomKeywordChange,
    onAddCustomKeyword,
    ticker,
    onTickerChange,
    timeRange,
    onTimeRangeChange
}: StoryKeywordFiltersProps) {
    return (
        <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="py-3 border-b border-zinc-800">
                <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Filter className="w-3 h-3" />
                    FILTERS
                </CardTitle>
            </CardHeader>
            <CardContent className="py-4 space-y-6">
                {/* Time Range */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Filter className="w-3 h-3" />
                        RANGE
                    </h3>
                    <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => onTimeRangeChange('30d')}
                            className={cn(
                                'px-3 py-1.5 text-xs font-bold transition-all',
                                timeRange === '30d'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                            )}
                        >
                            Last 30 Days
                        </button>
                        <button
                            type="button"
                            onClick={() => onTimeRangeChange('all')}
                            className={cn(
                                'px-3 py-1.5 text-xs font-bold transition-all border-l border-zinc-700',
                                timeRange === 'all'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                            )}
                        >
                            All Time
                        </button>
                    </div>
                </div>

                {/* Ticker Filter */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Building className="w-3 h-3" />
                        FILTER BY EMITEN
                    </h3>
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
                        placeholder="Enter Ticker (e.g. BBRI)"
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-64 font-mono uppercase"
                    />
                </div>

                {/* Keyword Filter */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Filter className="w-3 h-3" />
                        FILTER BY KEYWORDS
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {keywords.map(({ keyword, icon }) => {
                            const isSelected = selectedKeywords.includes(keyword);
                            const count = keywordStats?.[keyword] || 0;
                            return (
                                <button
                                    key={keyword}
                                    onClick={() => onToggleKeyword(keyword)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                                        isSelected
                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                            : 'bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-600'
                                    )}
                                >
                                    {icon} {keyword.charAt(0).toUpperCase() + keyword.slice(1)}
                                    {isSelected && count > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/30 text-[10px]">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={customKeyword}
                            onChange={(e) => onCustomKeywordChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onAddCustomKeyword()}
                            placeholder="Add custom keyword..."
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                        />
                        <button
                            onClick={onAddCustomKeyword}
                            className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-600 transition-all"
                        >
                            + Add
                        </button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
