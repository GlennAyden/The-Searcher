'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NewsItem } from '@/services/api/news';
import { newsService } from '../services/news-service';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';

interface NewsFeedProps {
    news: NewsItem[];
    loading: boolean;
    totalCount?: number;
    page?: number;
    pageSize?: number;
}

export const NewsFeed = ({ news, loading, totalCount, page = 1, pageSize = 0 }: NewsFeedProps) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [singleBriefs, setSingleBriefs] = useState<Record<string, string>>({});
    const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null);
    const effectivePageSize = pageSize || news.length || 0;
    const startIndex = totalCount ? (page - 1) * effectivePageSize + 1 : 0;
    const endIndex = totalCount ? Math.min(page * effectivePageSize, totalCount) : 0;

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

    const toggleGist = async (item: NewsItem) => {
        const id = item.id || item.title;
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(id);

        if (!singleBriefs[id]) {
            setBriefLoadingId(id);
            try {
                const insight = await newsService.getSingleNewsBrief(item.title, item.ticker);
                setSingleBriefs(prev => ({ ...prev, [id]: insight }));
            } catch (err) {
                console.error("Single brief failed:", err);
            } finally {
                setBriefLoadingId(null);
            }
        }
    };

    return (
        <Card className="w-full bg-zinc-950 border-zinc-900 shadow-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-900/50 pb-4">
                <CardTitle className="text-sm font-bold text-zinc-400 tracking-widest flex items-center gap-2">
                    📰 NEWS FEED
                </CardTitle>
                <div className="text-[10px] font-mono text-zinc-600 uppercase">
                    {totalCount !== undefined
                        ? `SHOWING ${startIndex}-${endIndex} OF ${totalCount}`
                        : `${news.length} ARTICLES FOUND`}
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-900/30 border-b border-zinc-900">
                            <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ticker</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Source</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Label</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Score</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest w-[40%] text-center">AI Insights & Title</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Link</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/50">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-zinc-600 font-mono animate-pulse uppercase tracking-tight">
                                    Updating Intelligence Feed...
                                </td>
                            </tr>
                        ) : news.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-zinc-600 italic">
                                    No news articles found for current criteria.
                                </td>
                            </tr>
                        ) : (
                            news.map((item, idx) => {
                                const id = item.id || item.title;
                                const isExpanded = expandedId === id;
                                return (
                                    <React.Fragment key={id || idx}>
                                        <tr className={cn(
                                            "hover:bg-zinc-900/20 transition-all group cursor-pointer",
                                            isExpanded && "bg-blue-500/10",
                                            Math.abs(item.score) >= 0.8 && "border-l-2 border-l-blue-500"
                                        )} onClick={() => toggleGist(item)}>
                                            <td className="px-6 py-4 text-[11px] text-zinc-500 font-mono">{item.date}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-bold text-zinc-300">{item.ticker}</span>
                                                    {Math.abs(item.score) >= 0.8 && (
                                                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter alternate-font">Critical Insight</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-medium text-blue-400">{item.source || 'Web News'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSentimentStyle(item.label)}`}>
                                                    {item.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-mono text-zinc-400">{item.score.toFixed(2)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-4">
                                                    <button
                                                        className={cn(
                                                            "mt-0.5 p-1 rounded-full transition-all shrink-0",
                                                            isExpanded ? "bg-blue-500 text-white" : "bg-zinc-900 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleGist(item);
                                                        }}
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                    </button>
                                                    <span className={cn(
                                                        "text-[11px] transition-colors leading-relaxed",
                                                        isExpanded ? "text-blue-200 font-bold" : "text-zinc-300 group-hover:text-blue-300"
                                                    )}>
                                                        {item.title}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:text-blue-400 underline text-[10px] font-mono"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    VIEW
                                                </a>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-blue-500/5 border-b border-blue-500/20">
                                                <td colSpan={7} className="px-20 py-6">
                                                    <div className="flex items-center gap-4 text-blue-400 mb-2">
                                                        <div className="h-px bg-blue-500/30 flex-1" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                                            <Sparkles className="w-2.5 h-2.5" /> AI INSIGHT DRAWER
                                                        </span>
                                                        <div className="h-px bg-blue-500/30 flex-1" />
                                                    </div>
                                                    <div className="min-h-[40px] flex items-center justify-start italic text-[12px] text-zinc-200 leading-relaxed font-serif tracking-wide border-l-2 border-blue-500/40 pl-6 py-2">
                                                        {briefLoadingId === id ? (
                                                            <div className="flex items-center gap-3">
                                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                                <span className="text-zinc-500 font-mono text-[10px] animate-pulse">GENERATING QUANTITATIVE INSIGHT...</span>
                                                            </div>
                                                        ) : (
                                                            singleBriefs[id] || "No insight available."
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
};
