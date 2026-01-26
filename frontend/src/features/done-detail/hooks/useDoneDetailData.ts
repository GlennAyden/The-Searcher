'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    doneDetailApi,
    type DateRangeInfo,
    type ImposterAnalysis,
    type SpeedAnalysis,
    type CombinedAnalysis,
    type RangeAnalysis
} from '@/services/api/doneDetail';

type MessageState = { type: 'success' | 'error'; text: string } | null;

export const useDoneDetailData = (initialTicker: string) => {
    const [availableTickers, setAvailableTickers] = useState<string[]>([]);
    const [selectedTicker, setSelectedTicker] = useState(initialTicker || '');
    const [dateRangeInfo, setDateRangeInfo] = useState<DateRangeInfo | null>(null);
    const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<MessageState>(null);

    const [analysisData, setAnalysisData] = useState<ImposterAnalysis | null>(null);
    const [speedData, setSpeedData] = useState<SpeedAnalysis | null>(null);
    const [combinedData, setCombinedData] = useState<CombinedAnalysis | null>(null);
    const [rangeData, setRangeData] = useState<RangeAnalysis | null>(null);

    const loadTickers = useCallback(async () => {
        try {
            const result = await doneDetailApi.getTickers();
            setAvailableTickers(result.tickers || []);
            if (!selectedTicker && result.tickers?.length > 0) {
                setSelectedTicker(result.tickers[0]);
            }
        } catch (error) {
            console.error('Error loading tickers:', error);
        }
    }, [selectedTicker]);

    const loadDateRange = useCallback(async (ticker: string) => {
        try {
            const result = await doneDetailApi.getDateRange(ticker);
            setDateRangeInfo(result);
            if (result.dates?.length > 0) {
                setStartDate(result.dates[0]);
                setEndDate(result.dates[0]);
            } else {
                setStartDate('');
                setEndDate('');
            }
        } catch (error) {
            console.error('Error loading date range:', error);
        }
    }, []);

    const loadData = useCallback(async () => {
        if (!selectedTicker || !startDate || !endDate) return;
        setLoading(true);
        try {
            const combined = await doneDetailApi.getCombinedAnalysis(selectedTicker, startDate, endDate);

            if (combined.error === 'no_synthesis') {
                console.warn('No synthesis data available:', combined.message);
                setCombinedData(null);
                setAnalysisData(null);
                setSpeedData(null);
                setRangeData(null);
                setLoading(false);
                return;
            }

            setCombinedData(combined);

            if (combined.imposter_analysis) {
                setAnalysisData(combined.imposter_analysis);
            } else {
                const imposter = await doneDetailApi.getImposterAnalysis(selectedTicker, startDate, endDate);
                if (!imposter.error) {
                    setAnalysisData(imposter);
                }
            }

            if (combined.speed_analysis) {
                setSpeedData(combined.speed_analysis);
            } else {
                const speed = await doneDetailApi.getSpeedAnalysis(selectedTicker, startDate, endDate);
                if (!speed.error) {
                    setSpeedData(speed);
                }
            }

            if (dateMode === 'range' && startDate !== endDate) {
                const range = await doneDetailApi.getRangeAnalysis(selectedTicker, startDate, endDate);
                setRangeData(range);
            } else {
                setRangeData(null);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setMessage({ type: 'error', text: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    }, [selectedTicker, startDate, endDate, dateMode]);

    useEffect(() => {
        loadTickers();
    }, [loadTickers]);

    useEffect(() => {
        if (selectedTicker) loadDateRange(selectedTicker);
    }, [selectedTicker, loadDateRange]);

    useEffect(() => {
        if (selectedTicker && startDate && endDate) loadData();
    }, [selectedTicker, startDate, endDate, loadData]);

    useEffect(() => {
        if (dateMode === 'single' && startDate) setEndDate(startDate);
    }, [dateMode, startDate]);

    return {
        availableTickers,
        selectedTicker,
        setSelectedTicker,
        dateRangeInfo,
        dateMode,
        setDateMode,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        loading,
        message,
        setMessage,
        analysisData,
        speedData,
        combinedData,
        rangeData,
        loadTickers,
        loadDateRange,
        loadData
    };
};
