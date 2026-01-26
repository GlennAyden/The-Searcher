import { useCallback, useEffect, useState } from 'react';
import { newsService } from '../services/news-service';
import type { NewsItem } from '@/services/api/news';

type UseNewsLibraryProps = {
    ticker: string;
    startDate: string;
    endDate: string;
};

export const useNewsLibrary = ({ ticker, startDate, endDate }: UseNewsLibraryProps) => {
    const [sentimentFilter, setSentimentFilter] = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [tickerFilter, setTickerFilter] = useState(ticker === 'All' ? '' : ticker);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Sync local ticker filter when global ticker changes, but carefully
    useEffect(() => {
        if (ticker !== 'All') {
            setTickerFilter(ticker);
        } else if (ticker === 'All' && tickerFilter === '') {
            // Keep empty if it was empty and all is selected, or maybe reset?
            // Let's just reset to empty if global switches to 'All'
            setTickerFilter('');
        }
    }, [ticker]);

    const fetchNews = useCallback(async () => {
        setLoading(true);
        try {
            // Use local tickerFilter if present, otherwise treat as All (undefined in service)
            // But if tickerFilter is empty string, we treat as All
            const queryTicker = tickerFilter && tickerFilter.trim() !== '' ? tickerFilter : undefined;

            const newsData = await newsService.getNews(
                queryTicker,
                startDate,
                endDate,
                sentimentFilter,
                sourceFilter
            );
            setNews(newsData);
        } catch (error) {
            console.error('Failed to fetch news library data:', error);
        } finally {
            setLoading(false);
        }
    }, [tickerFilter, startDate, endDate, sentimentFilter, sourceFilter]);

    useEffect(() => {
        // debounce fetch if ticker is typing? Actually keeping it simple for now, 
        // maybe add a small debounce if I could, but useCallback dependency handles it. 
        // With standard React, typing will trigger rapid fetches. 
        // For this task, standard useEffect is acceptable, but a debounce would be better.
        // Let's rely on standard behavior first.
        const timeoutId = setTimeout(() => {
            fetchNews();
        }, 500); // 500ms debounce for typing

        return () => clearTimeout(timeoutId);
    }, [fetchNews]);

    return {
        news,
        loading,
        sentimentFilter,
        setSentimentFilter,
        sourceFilter,
        setSourceFilter,
        tickerFilter,
        setTickerFilter,
        refresh: fetchNews
    };
};
