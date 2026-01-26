'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { dashboardApi } from '@/services/api/dashboard';
import {
    priceVolumeApi,
    type HKAnalysisResponse,
    type MarketCapResponse,
    type PriceVolumeResponse,
    type RefreshAllResponse,
    type SpikeMarker,
    type UnusualVolumeEvent
} from '@/services/api/priceVolume';

export const usePriceVolumeData = () => {
    const [ticker, setTicker] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [chartData, setChartData] = useState<PriceVolumeResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [unusualVolumes, setUnusualVolumes] = useState<UnusualVolumeEvent[]>([]);
    const [isLoadingUnusual, setIsLoadingUnusual] = useState(false);

    const [spikeMarkers, setSpikeMarkers] = useState<SpikeMarker[]>([]);
    const [marketCapData, setMarketCapData] = useState<MarketCapResponse | null>(null);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshResult, setRefreshResult] = useState<RefreshAllResponse | null>(null);
    const [showRefreshResult, setShowRefreshResult] = useState(false);

    const [hkAnalysis, setHkAnalysis] = useState<HKAnalysisResponse | null>(null);
    const [isLoadingHK, setIsLoadingHK] = useState(false);

    const handleRefreshAll = useCallback(async () => {
        setIsRefreshing(true);
        setRefreshResult(null);
        setShowRefreshResult(false);

        try {
            const result = await priceVolumeApi.refreshAllTickers();
            setRefreshResult(result);
            setShowRefreshResult(true);

            setTimeout(() => setShowRefreshResult(false), 10000);
        } catch (err) {
            console.error('Failed to refresh all tickers:', err);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const fetchUnusualVolumes = async () => {
            setIsLoadingUnusual(true);
            try {
                const response = await priceVolumeApi.scanUnusualVolumes(30, 2.0, 20);
                setUnusualVolumes(response.unusual_volumes);
            } catch (err) {
                console.error('Failed to fetch unusual volumes:', err);
            } finally {
                setIsLoadingUnusual(false);
            }
        };

        fetchUnusualVolumes();
    }, []);

    const handleSearch = useCallback(async (tickerSymbol: string) => {
        if (!tickerSymbol.trim()) return;

        setIsLoading(true);
        setError(null);
        setTicker(tickerSymbol.toUpperCase());
        setShowSuggestions(false);

        try {
            const data = await priceVolumeApi.getOHLCV(tickerSymbol);
            setChartData(data);

            try {
                const markersResponse = await priceVolumeApi.getSpikeMarkers(tickerSymbol);
                setSpikeMarkers(markersResponse.markers);
            } catch (err) {
                console.error('Failed to fetch spike markers:', err);
                setSpikeMarkers([]);
            }

            try {
                const mcapResponse = await priceVolumeApi.getMarketCap(tickerSymbol);
                setMarketCapData(mcapResponse);
            } catch (err) {
                console.error('Failed to fetch market cap:', err);
                setMarketCapData(null);
            }

            try {
                setIsLoadingHK(true);
                const hkResponse = await priceVolumeApi.getHKAnalysis(tickerSymbol);
                setHkAnalysis(hkResponse);
            } catch (err) {
                console.error('Failed to fetch HK analysis:', err);
                setHkAnalysis(null);
            } finally {
                setIsLoadingHK(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
            setChartData(null);
            setSpikeMarkers([]);
            setMarketCapData(null);
            setHkAnalysis(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleInputChange = useCallback(async (value: string) => {
        setSearchInput(value);

        if (value.length >= 1) {
            try {
                const tickers = await dashboardApi.getTickers();
                const uniqueTickers = Array.from(new Set(tickers));
                const filtered = uniqueTickers.filter((t: string) =>
                    t.toLowerCase().includes(value.toLowerCase())
                );
                setSuggestions(filtered.slice(0, 8));
                setShowSuggestions(true);
            } catch {
                setSuggestions([]);
            }
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, []);

    const handleSubmit = useCallback((event: FormEvent) => {
        event.preventDefault();
        handleSearch(searchInput);
    }, [handleSearch, searchInput]);

    const handleSuggestionClick = useCallback((suggestion: string) => {
        setSearchInput(suggestion);
        handleSearch(suggestion);
    }, [handleSearch]);

    const handleUnusualVolumeClick = useCallback((tickerSymbol: string) => {
        setSearchInput(tickerSymbol);
        handleSearch(tickerSymbol);
    }, [handleSearch]);

    return {
        ticker,
        searchInput,
        chartData,
        isLoading,
        error,
        suggestions,
        showSuggestions,
        unusualVolumes,
        isLoadingUnusual,
        spikeMarkers,
        marketCapData,
        isRefreshing,
        refreshResult,
        showRefreshResult,
        hkAnalysis,
        isLoadingHK,
        setShowSuggestions,
        setShowRefreshResult,
        handleRefreshAll,
        handleInputChange,
        handleSubmit,
        handleSuggestionClick,
        handleUnusualVolumeClick
    };
};
