'use client';

import { NewsFeed } from '@/features/news/components/news-feed';
import { NewsLibraryFilters } from '@/features/news/components/NewsLibraryFilters';
import { useNewsLibrary } from '@/features/news/hooks/useNewsLibrary';
import { useFilter } from '@/context/filter-context';

export default function NewsLibraryPage() {
    const { ticker, dateRange } = useFilter();
    const {
        news,
        loading,
        sentimentFilter,
        setSentimentFilter,
        sourceFilter,
        setSourceFilter,
        tickerFilter,
        setTickerFilter
    } = useNewsLibrary({
        ticker,
        startDate: dateRange.start,
        endDate: dateRange.end
    });

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen bg-zinc-950 text-zinc-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    <span className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">NEWS</span>
                    NEWS & DISCLOSURES LIBRARY
                </h1>

                <NewsLibraryFilters
                    sentimentFilter={sentimentFilter}
                    sourceFilter={sourceFilter}
                    tickerFilter={tickerFilter}
                    onSentimentChange={setSentimentFilter}
                    onSourceChange={setSourceFilter}
                    onTickerChange={setTickerFilter}
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                <NewsFeed news={news} loading={loading} />
            </div>
        </div>
    );
}
