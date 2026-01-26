'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { neobdmApi } from '@/services/api/neobdm';
import type { ChartRow, FlowHistoryRow, HotSignal, VolumeChartPoint } from '../types';

type UseFlowTrackerDataArgs = {
    symbol: string;
    method: string;
    period: string;
    limit: number;
    flowMetric: string;
    onSymbolChange: (symbol: string) => void;
};

export const useFlowTrackerData = ({
    symbol,
    method,
    period,
    limit,
    flowMetric,
    onSymbolChange
}: UseFlowTrackerDataArgs) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<FlowHistoryRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [availableTickers, setAvailableTickers] = useState<string[]>([]);
    const [hotSignals, setHotSignals] = useState<HotSignal[]>([]);

    const [volumeData, setVolumeData] = useState<VolumeChartPoint[]>([]);
    const [volumeLoading, setVolumeLoading] = useState(false);
    const [volumeError, setVolumeError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const result = await neobdmApi.getNeoBDMTickers();
                setAvailableTickers(result.tickers || []);

                const hotResult = await neobdmApi.getNeoBDMHotList();
                setHotSignals(hotResult.signals || []);

                const urlParams = new URLSearchParams(window.location.search);
                const tickerParam = urlParams.get('ticker');

                if (tickerParam) {
                    onSymbolChange(tickerParam);
                } else if (hotResult.signals && hotResult.signals.length > 0) {
                    onSymbolChange(hotResult.signals[0].symbol);
                } else if (result.tickers && result.tickers.length > 0) {
                    if (!result.tickers.includes('BBCA') && !result.tickers.some(t => t.includes('BBCA'))) {
                        onSymbolChange(result.tickers[0]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch NeoBDM tickers/hot list', err);
            }
        };

        init();
    }, [onSymbolChange]);

    const loadData = useCallback(async () => {
        if (!symbol) return;
        setLoading(true);
        setError(null);
        try {
            const result = await neobdmApi.getNeoBDMHistory(symbol, method, period, limit);
            setData(result.history as FlowHistoryRow[]);

            if (result.history.length === 0) {
                setError(`No historical data found for ${symbol}`);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load flow history';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [symbol, method, period, limit]);

    const loadVolumeData = useCallback(async () => {
        if (!symbol) return;
        setVolumeLoading(true);
        setVolumeError(null);
        try {
            const result = await neobdmApi.getVolumeDaily(symbol);
            const formattedData = result.data.map(item => ({
                ...item,
                date: new Date(item.trade_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
                fullDate: item.trade_date
            })).reverse();
            setVolumeData(formattedData);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load volume data';
            setVolumeError(message);
        } finally {
            setVolumeLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        loadData();
        loadVolumeData();
    }, [loadData, loadVolumeData]);

    const chartData = useMemo<ChartRow[]>(() => {
        return data.map(item => ({
            ...item,
            activeFlow: item[flowMetric] || item.flow,
            date: new Date(item.scraped_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
            fullDate: item.scraped_at,
            isCrossing: !!(item.crossing && item.crossing.toLowerCase() !== 'x' && item.crossing.toLowerCase() !== 'null'),
            isUnusual: !!(item.unusual && item.unusual.toLowerCase() !== 'x' && item.unusual.toLowerCase() !== 'null'),
            isPinky: !!(item.pinky && item.pinky.toLowerCase() !== 'x' && item.pinky.toLowerCase() !== 'null'),
            crossingVal: item.crossing,
            unusualVal: item.unusual,
            pinkyVal: item.pinky
        } as ChartRow)).reverse();
    }, [data, flowMetric]);

    return {
        availableTickers,
        hotSignals,
        chartData,
        loading,
        error,
        volumeData,
        volumeLoading,
        volumeError
    };
};
