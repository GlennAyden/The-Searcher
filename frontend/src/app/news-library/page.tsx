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
        setTickerFilter,
        timeRange,
        setTimeRange,
        page,
        setPage,
        totalCount,
        totalPages,
        pageSize
    } = useNewsLibrary({
        ticker,
        startDate: dateRange.start,
        endDate: dateRange.end
    });

    const pageItems = (() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const items: Array<number | '...'> = [1];
        if (page > 3) items.push('...');
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);
        for (let p = start; p <= end; p++) items.push(p);
        if (page < totalPages - 2) items.push('...');
        items.push(totalPages);
        return items;
    })();

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
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                <NewsFeed
                    news={news}
                    loading={loading}
                    totalCount={totalCount}
                    page={page}
                    pageSize={pageSize}
                />
            </div>

            {totalPages > 1 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
                    <div>
                        Showing <span className="text-zinc-200 font-bold">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</span>
                        {' '}to <span className="text-zinc-200 font-bold">{Math.min(page * pageSize, totalCount)}</span>
                        {' '}of <span className="text-zinc-200 font-bold">{totalCount}</span> articles
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400"
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page <= 1}
                        >
                            Prev
                        </button>
                        <div className="flex items-center gap-1">
                            {pageItems.map((item, idx) =>
                                item === '...' ? (
                                    <span key={`ellipsis-${idx}`} className="px-2 text-zinc-600">...</span>
                                ) : (
                                    <button
                                        key={item}
                                        onClick={() => setPage(item)}
                                        className={`px-2 py-1 rounded border text-xs ${
                                            page === item
                                                ? 'border-blue-500/60 text-blue-300 bg-blue-500/10'
                                                : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                )
                            )}
                        </div>
                        <button
                            className="px-2 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400"
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page >= totalPages}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
