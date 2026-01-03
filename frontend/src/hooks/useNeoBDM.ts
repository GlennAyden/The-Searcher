/**
 * NeoBDM-specific hooks
 * 
 * Encapsulates NeoBDM market maker and fund flow logic
 */

import { useState, useEffect, useCallback } from 'react';
import { neobdmApi } from '@/services/api/neobdm';
import { useApi } from './useApi';

/**
 * Hook for NeoBDM summary data
 */
export function useNeoBDMSummary(
    method: string = 'm',
    period: string = 'c',
    scrapeDate?: string
) {
    const { data, loading, error, execute } = useApi(neobdmApi.getNeoBDMSummary);
    const [isScrapingLoading, setIsScrapingLoading] = useState(false);

    // Fetch data on mount and when params change
    useEffect(() => {
        execute(method, period, false, scrapeDate);
    }, [method, period, scrapeDate, execute]);

    // Scrape fresh data
    const scrape = useCallback(async () => {
        setIsScrapingLoading(true);
        try {
            await execute(method, period, true);
        } finally {
            setIsScrapingLoading(false);
        }
    }, [method, period, execute]);

    return {
        summary: data,
        loading: loading || isScrapingLoading,
        error,
        scrape,
        refetch: () => execute(method, period, false, scrapeDate)
    };
}

/**
 * Hook for available NeoBDM scrape dates
 */
export function useNeoBDMDates() {
    const [dates, setDates] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        neobdmApi.getNeoBDMDates()
            .then(response => setDates(response.dates))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return { dates, loading };
}

/**
 * Hook for NeoBDM batch scraping
 */
export function useNeoBDMBatchScrape() {
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<{ status: string; message: string; details?: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runBatchScrape = useCallback(async () => {
        setIsRunning(true);
        setError(null);

        try {
            const response = await neobdmApi.runNeoBDMBatchScrape();
            setResult(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Batch scrape failed');
        } finally {
            setIsRunning(false);
        }
    }, []);

    return { isRunning, result, error, runBatchScrape };
}

/**
 * Hook for NeoBDM historical data for a symbol
 */
export function useNeoBDMHistory(
    symbol: string,
    method: string = 'm',
    period: string = 'c',
    limit: number = 30
) {
    const { data, loading, error, execute } = useApi(neobdmApi.getNeoBDMHistory);

    useEffect(() => {
        if (symbol) {
            execute(symbol, method, period, limit);
        }
    }, [symbol, method, period, limit, execute]);

    return {
        history: data?.history || [],
        loading,
        error,
        refetch: () => execute(symbol, method, period, limit)
    };
}

/**
 * Hook for NeoBDM tickers
 */
export function useNeoBDMTickers() {
    const [tickers, setTickers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        neobdmApi.getNeoBDMTickers()
            .then(response => setTickers(response.tickers))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return { tickers, loading };
}

/**
 * Hook for hot signals
 */
export function useNeoBDMHotList() {
    const { data, loading, error, execute } = useApi(neobdmApi.getNeoBDMHotList);

    useEffect(() => {
        execute();
    }, [execute]);

    return {
        signals: data?.signals || [],
        loading,
        error,
        refetch: execute
    };
}
