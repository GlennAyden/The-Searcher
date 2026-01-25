'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, Search, Filter, ExternalLink, TrendingUp } from 'lucide-react';
import { useFilter } from '@/context/filter-context';

// Types
interface StoryItem {
    id: string;
    date: string;
    date_display: string;
    ticker: string;
    title: string;
    matched_keywords: string[];
    primary_category: string;
    primary_icon: string;
    highlight_positions: number[][];
    sentiment_label: string;
    sentiment_score: number;
    source: string;
    url: string;
}

interface KeywordInfo {
    keyword: string;
    category: string;
    icon: string;
}

interface StoryFinderResponse {
    stories: StoryItem[];
    keyword_stats: Record<string, number>;
    total: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Default keywords
const DEFAULT_KEYWORDS: KeywordInfo[] = [
    { keyword: 'right issue', category: 'Equity Raise', icon: '🔄' },
    { keyword: 'akuisisi', category: 'M&A', icon: '🏢' },
    { keyword: 'merger', category: 'M&A', icon: '🏢' },
    { keyword: 'dividen', category: 'Dividend', icon: '💰' },
    { keyword: 'buyback', category: 'Buyback', icon: '💵' },
    { keyword: 'stock split', category: 'Split', icon: '📊' },
    { keyword: 'tender offer', category: 'Tender', icon: '📋' },
    { keyword: 'ipo', category: 'IPO', icon: '🚀' },
];

// Highlight text component
const HighlightedText = ({ text, positions }: { text: string; positions: number[][] }) => {
    if (!positions || positions.length === 0) {
        return <span>{text}</span>;
    }

    // Sort positions and merge overlapping
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
};

// Story Card component
const StoryCard = ({ story }: { story: StoryItem }) => {
    const getSentimentStyle = (label: string) => {
        switch (label) {
            case 'Bullish':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'Bearish':
                return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            default:
                return 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50';
        }
    };

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-all group">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {/* Category & Sentiment badges */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {story.primary_icon} {story.primary_category.toUpperCase()}
                        </span>
                        <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold border",
                            getSentimentStyle(story.sentiment_label)
                        )}>
                            {story.sentiment_label}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{story.source}</span>
                    </div>

                    {/* Title with highlights */}
                    <h3 className="text-sm text-zinc-200 font-medium leading-relaxed mb-2">
                        <HighlightedText text={story.title} positions={story.highlight_positions} />
                    </h3>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                        <span className="font-bold text-blue-400">{story.ticker}</span>
                        <span>•</span>
                        <span>{story.date_display}</span>
                    </div>
                </div>

                {/* Link */}
                <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:text-blue-400 hover:bg-zinc-700 transition-all shrink-0"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
};

// Main Page Component
export default function StoryFinderPage() {
    const { dateRange } = useFilter();
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>(['right issue', 'akuisisi', 'dividen']);
    const [data, setData] = useState<StoryFinderResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [customKeyword, setCustomKeyword] = useState('');

    const fetchStories = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                keywords: selectedKeywords.join(','),
                start_date: dateRange.start,
                end_date: dateRange.end
            });

            const response = await fetch(`${API_BASE_URL}/api/story-finder?${params}`);
            if (response.ok) {
                const result = await response.json();
                setData(result);
            }
        } catch (error) {
            console.error('Story Finder fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedKeywords.length > 0) {
            fetchStories();
        } else {
            setData({ stories: [], keyword_stats: {}, total: 0 });
            setLoading(false);
        }
    }, [selectedKeywords, dateRange]);

    const toggleKeyword = (keyword: string) => {
        setSelectedKeywords(prev =>
            prev.includes(keyword)
                ? prev.filter(k => k !== keyword)
                : [...prev, keyword]
        );
    };

    const addCustomKeyword = () => {
        const kw = customKeyword.trim().toLowerCase();
        if (kw && !selectedKeywords.includes(kw)) {
            setSelectedKeywords(prev => [...prev, kw]);
            setCustomKeyword('');
        }
    };

    // Group stories by date
    const groupedStories = useMemo(() => {
        if (!data?.stories) return {};

        const groups: Record<string, StoryItem[]> = {};
        data.stories.forEach(story => {
            const date = story.date;
            if (!groups[date]) groups[date] = [];
            groups[date].push(story);
        });
        return groups;
    }, [data?.stories]);

    const sortedDates = Object.keys(groupedStories).sort((a, b) => b.localeCompare(a));

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen bg-zinc-950 text-zinc-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <span className="p-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg shadow-lg shadow-orange-900/20">
                        <Search className="w-5 h-5" />
                    </span>
                    STORY FINDER
                </h1>

                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <TrendingUp className="w-4 h-4" />
                    <span>Track Corporate Actions</span>
                </div>
            </div>

            {/* Keyword Chips */}
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="py-3 border-b border-zinc-800">
                    <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <Filter className="w-3 h-3" />
                        KEYWORD FILTERS
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {DEFAULT_KEYWORDS.map(({ keyword, icon }) => {
                            const isSelected = selectedKeywords.includes(keyword);
                            const count = data?.keyword_stats?.[keyword] || 0;
                            return (
                                <button
                                    key={keyword}
                                    onClick={() => toggleKeyword(keyword)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                        isSelected
                                            ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                                            : "bg-zinc-800/50 text-zinc-500 border-zinc-700 hover:border-zinc-600"
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

                    {/* Custom keyword input */}
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={customKeyword}
                            onChange={(e) => setCustomKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addCustomKeyword()}
                            placeholder="Add custom keyword..."
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                        />
                        <button
                            onClick={addCustomKeyword}
                            className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-600 transition-all"
                        >
                            + Add
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Bar */}
            {data && (
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-zinc-400">
                        Found <span className="font-bold text-white">{data.total}</span> stories
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-500">
                        {selectedKeywords.length} keywords active
                    </span>
                </div>
            )}

            {/* Timeline */}
            <div className="space-y-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="ml-3 text-zinc-500 text-sm">Searching stories...</span>
                    </div>
                ) : sortedDates.length === 0 ? (
                    <div className="text-center py-20 text-zinc-600">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No stories found matching your keywords.</p>
                        <p className="text-sm mt-2">Try selecting different keywords or adjusting the date range.</p>
                    </div>
                ) : (
                    sortedDates.map(date => (
                        <div key={date}>
                            {/* Date header */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                                    {new Date(date).toLocaleDateString('id-ID', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </h2>
                                <span className="text-[10px] text-zinc-600 font-mono">
                                    {groupedStories[date].length} stories
                                </span>
                                <div className="flex-1 h-px bg-zinc-800" />
                            </div>

                            {/* Stories for this date */}
                            <div className="space-y-3 ml-6 border-l-2 border-zinc-800 pl-6">
                                {groupedStories[date].map(story => (
                                    <StoryCard key={story.id} story={story} />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
