'use client';

import React, { useState, useEffect } from 'react';
import { api, NewsItem } from '@/services/api';
import { NewsFeed } from '@/components/news-library/news-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useFilter } from '@/context/filter-context';

export default function NewsLibraryPage() {
    const { ticker, dateRange } = useFilter();
    const [sentimentFilter, setSentimentFilter] = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const newsData = await api.getNews(
                ticker === 'All' ? undefined : ticker,
                dateRange.start,
                dateRange.end,
                sentimentFilter,
                sourceFilter
            );
            setNews(newsData);
        } catch (error) {
            console.error("Failed to fetch news library data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [ticker, dateRange, sentimentFilter, sourceFilter]);

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen bg-zinc-950 text-zinc-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <span className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">📰</span>
                    NEWS & DISCLOSURES LIBRARY
                </h1>

                {/* Local Filters */}
                <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 p-2 rounded-xl border border-zinc-800 backdrop-blur-sm self-end">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-2">Filter Source:</span>
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value)}
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
                            onChange={(e) => setSentimentFilter(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 outline-none w-[150px]"
                        >
                            <option value="All">All Sentiments</option>
                            <option value="Bullish Only">🐂 Bullish Only</option>
                            <option value="Bearish Only">🐻 Bearish Only</option>
                            <option value="Netral Only">⚖️ Netral Only</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* News Feed Section */}
                <NewsFeed news={news} loading={loading} />
            </div>
        </div>
    );
}
