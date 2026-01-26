import { useCallback, useEffect, useState } from 'react';
import { neobdmApi } from '@/services/api/neobdm';
import type { BrokerSummaryRow } from '@/types/broker-summary';

type UseBrokerSummaryDataArgs = {
    ticker: string;
    date: string;
    tickerError: string | null;
};

const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string' && err.trim()) return err;
    return fallback;
};

export const useBrokerSummaryData = ({ ticker, date, tickerError }: UseBrokerSummaryDataArgs) => {
    const [buyData, setBuyData] = useState<BrokerSummaryRow[]>([]);
    const [sellData, setSellData] = useState<BrokerSummaryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadData = useCallback(async (forceScrape = false) => {
        if (forceScrape) setSyncing(true);
        else setLoading(true);

        setError(null);
        setSuccess(null);

        try {
            const data = await neobdmApi.getNeoBDMBrokerSummary(ticker, date, forceScrape);
            setBuyData((data.buy || []) as BrokerSummaryRow[]);
            setSellData((data.sell || []) as BrokerSummaryRow[]);

            if (forceScrape) {
                setSuccess(data.source === 'scraper' ? "Sync completed successfully!" : "Data fetched from database.");
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load broker summary"));
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    }, [ticker, date]);

    useEffect(() => {
        if (ticker.length < 4) return;
        if (tickerError) {
            setBuyData([]);
            setSellData([]);
            return;
        }
        loadData();
    }, [ticker, date, tickerError, loadData]);

    return {
        buyData,
        sellData,
        loading,
        syncing,
        error,
        success,
        loadData,
        setError,
        setSuccess,
        setSyncing
    };
};
