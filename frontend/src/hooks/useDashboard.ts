/**
 * Dashboard-specific hooks
 * 
 * Encapsulates dashboard data fetching logic
 */

import { useState, useEffect } from 'react';
import { dashboardApi, type DashboardStats, type SentimentDataPoint } from '@/services/api/dashboard';
import { type StockData } from '@/types/market';
import { useApi } from './useApi';

/**
 * Hook for dashboard statistics
 */
export function useDashboardStats(ticker: string, startDate?: string, endDate?: string) {
    const { data, loading, error, execute } = useApi(dashboardApi.getDashboardStats);

    useEffect(() => {
        if (ticker) {
            execute(ticker, startDate, endDate);
        }
    }, [ticker, startDate, endDate, execute]);

    return { stats: data, loading, error, refetch: () => execute(ticker, startDate, endDate) };
}

/**
 * Hook for market OHLC data
 */
export function useMarketData(ticker: string, startDate?: string, endDate?: string) {
    const { data, loading, error, execute } = useApi<StockData[], [string, string?, string?]>(
        dashboardApi.getMarketData
    );

    useEffect(() => {
        if (ticker) {
            execute(ticker, startDate, endDate);
        }
    }, [ticker, startDate, endDate, execute]);

    return { marketData: data, loading, error, refetch: () => execute(ticker, startDate, endDate) };
}

/**
 * Hook for sentiment history
 */
export function useSentimentHistory(ticker: string, startDate?: string, endDate?: string) {
    const { data, loading, error, execute } = useApi<SentimentDataPoint[], [string, string?, string?]>(
        dashboardApi.getSentimentHistory
    );

    useEffect(() => {
        if (ticker) {
            execute(ticker, startDate, endDate);
        }
    }, [ticker, startDate, endDate, execute]);

    return { sentimentData: data, loading, error, refetch: () => execute(ticker, startDate, endDate) };
}

/**
 * Combined hook for all dashboard data
 * 
 * Fetches stats, market data, and sentiment in parallel
 */
export function useDashboard(ticker: string, startDate?: string, endDate?: string) {
    const stats = useDashboardStats(ticker, startDate, endDate);
    const market = useMarketData(ticker, startDate, endDate);
    const sentiment = useSentimentHistory(ticker, startDate, endDate);

    return {
        stats: stats.stats,
        marketData: market.marketData,
        sentimentData: sentiment.sentimentData,
        loading: stats.loading || market.loading || sentiment.loading,
        error: stats.error || market.error || sentiment.error,
        refetch: () => {
            stats.refetch();
            market.refetch();
            sentiment.refetch();
        }
    };
}

/**
 * Hook for available tickers
 */
export function useTickers() {
    const [tickers, setTickers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        dashboardApi.getTickers()
            .then(setTickers)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return { tickers, loading };
}
