/**
 * News-specific hooks
 * 
 * Encapsulates news fetching and AI insights logic
 */

import { useState, useEffect, useCallback } from 'react';
import { newsApi, type NewsItem, type TickerCount } from '@/services/api/news';
import { useApi } from './useApi';

/**
 * Hook for fetching news articles
 */
export function useNews(
    ticker?: string,
    startDate?: string,
    endDate?: string,
    sentiment: string = "All",
    source: string = "All"
) {
    const { data, loading, error, execute } = useApi(newsApi.getNews);

    useEffect(() => {
        execute(ticker, startDate, endDate, sentiment, source);
    }, [ticker, startDate, endDate, sentiment, source, execute]);

    return {
        news: data || [],
        loading,
        error,
        refetch: () => execute(ticker, startDate, endDate, sentiment, source)
    };
}

/**
 * Hook for AI-generated news brief
 */
export function useNewsBrief(
    ticker?: string,
    startDate?: string,
    endDate?: string,
    sentiment: string = "All",
    source: string = "All"
) {
    const [brief, setBrief] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const fetchBrief = useCallback(async () => {
        setLoading(true);
        try {
            const result = await newsApi.getBriefNews(ticker, startDate, endDate, sentiment, source);
            setBrief(result);
        } catch (err) {
            console.error('Failed to fetch brief:', err);
        } finally {
            setLoading(false);
        }
    }, [ticker, startDate, endDate, sentiment, source]);

    return { brief, loading, fetchBrief };
}

/**
 * Hook for single news article AI insight
 */
export function useSingleNewsInsight() {
    const [insights, setInsights] = useState<Map<string, string>>(new Map());
    const [loadingMap, setLoadingMap] = useState<Map<string, boolean>>(new Map());

    const getInsight = useCallback(async (title: string, ticker?: string) => {
        const key = `${title}-${ticker}`;

        // Return cached if available
        if (insights.has(key)) {
            return insights.get(key)!;
        }

        // Set loading
        setLoadingMap(prev => new Map(prev).set(key, true));

        try {
            const result = await newsApi.getSingleNewsBrief(title, ticker);
            setInsights(prev => new Map(prev).set(key, result));
            return result;
        } catch (err) {
            console.error('Failed to fetch insight:', err);
            return 'Failed to fetch insight.';
        } finally {
            setLoadingMap(prev => {
                const newMap = new Map(prev);
                newMap.delete(key);
                return newMap;
            });
        }
    }, [insights]);

    const isLoading = useCallback((title: string, ticker?: string) => {
        const key = `${title}-${ticker}`;
        return loadingMap.get(key) || false;
    }, [loadingMap]);

    return { getInsight, isLoading };
}

/**
 * Hook for word cloud
 */
export function useWordCloud(ticker?: string, startDate?: string, endDate?: string) {
    const { data, loading, error, execute } = useApi(newsApi.getWordCloud);

    useEffect(() => {
        execute(ticker, startDate, endDate);
    }, [ticker, startDate, endDate, execute]);

    return {
        wordCloud: data?.image || null,
        loading,
        error,
        refetch: () => execute(ticker, startDate, endDate)
    };
}

/**
 * Hook for ticker mention counts
 */
export function useTickerCounts(ticker?: string, startDate?: string, endDate?: string) {
    const { data, loading, error, execute } = useApi<TickerCount[], [string?, string?, string?]>(
        newsApi.getTickerCounts
    );

    useEffect(() => {
        execute(ticker, startDate, endDate);
    }, [ticker, startDate, endDate, execute]);

    return {
        counts: data || [],
        loading,
        error,
        refetch: () => execute(ticker, startDate, endDate)
    };
}
