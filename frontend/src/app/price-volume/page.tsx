'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, TrendingUp, Loader2, Database } from 'lucide-react';
import { PriceVolumeChart } from '@/components/charts/PriceVolumeChart';
import { UnusualVolumeList } from '@/components/charts/UnusualVolumeList';
import { priceVolumeApi, PriceVolumeResponse, UnusualVolumeEvent, SpikeMarker } from '@/services/api/priceVolume';
import { api } from '@/services/api';

export default function PriceVolumePage() {
    const [ticker, setTicker] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [chartData, setChartData] = useState<PriceVolumeResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Unusual volume state
    const [unusualVolumes, setUnusualVolumes] = useState<UnusualVolumeEvent[]>([]);
    const [isLoadingUnusual, setIsLoadingUnusual] = useState(false);

    // Spike markers state
    const [spikeMarkers, setSpikeMarkers] = useState<SpikeMarker[]>([]);

    // Fetch unusual volumes on mount
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

    // Handle ticker search
    const handleSearch = useCallback(async (tickerSymbol: string) => {
        if (!tickerSymbol.trim()) return;

        setIsLoading(true);
        setError(null);
        setTicker(tickerSymbol.toUpperCase());
        setShowSuggestions(false);

        try {
            const data = await priceVolumeApi.getOHLCV(tickerSymbol);
            setChartData(data);

            // Fetch spike markers for this ticker
            try {
                const markersResponse = await priceVolumeApi.getSpikeMarkers(tickerSymbol);
                setSpikeMarkers(markersResponse.markers);
            } catch (err) {
                console.error('Failed to fetch spike markers:', err);
                setSpikeMarkers([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
            setChartData(null);
            setSpikeMarkers([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Handle input change with autocomplete
    const handleInputChange = async (value: string) => {
        setSearchInput(value);

        if (value.length >= 1) {
            try {
                const tickers = await api.getTickers();
                const filtered = tickers.filter((t: string) =>
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
    };

    // Handle form submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSearch(searchInput);
    };

    // Handle suggestion click
    const handleSuggestionClick = (suggestion: string) => {
        setSearchInput(suggestion);
        handleSearch(suggestion);
    };

    // Handle unusual volume ticker click
    const handleUnusualVolumeClick = (tickerSymbol: string) => {
        setSearchInput(tickerSymbol);
        handleSearch(tickerSymbol);
    };

    return (
        <div className="min-h-full flex flex-col gap-4 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20">
                        <TrendingUp className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                            Price & Volume
                        </h1>
                        <p className="text-sm text-zinc-500">
                            Interactive candlestick chart with moving averages
                        </p>
                    </div>
                </div>

                {/* Data source indicator */}
                {chartData && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800">
                        <Database className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-400">
                            {chartData.records_count} records
                            {chartData.source !== 'database' && (
                                <span className="ml-2 text-emerald-400">
                                    +{chartData.records_added} new
                                </span>
                            )}
                        </span>
                    </div>
                )}
            </div>

            {/* Search Section */}
            <div className="relative flex-shrink-0">
                <form onSubmit={handleSubmit} className="relative">
                    <div className="relative flex items-center">
                        <Search className="absolute left-4 w-5 h-5 text-zinc-500" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="Enter ticker symbol (e.g., BBCA, ANTM, TLKM)"
                            className="w-full pl-12 pr-32 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !searchInput.trim()}
                            className="absolute right-2 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-emerald-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                'Analyze'
                            )}
                        </button>
                    </div>
                </form>

                {/* Autocomplete suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                        {suggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex-shrink-0">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Chart Section - Fixed height */}
            {chartData ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden flex-shrink-0" style={{ height: '520px' }}>
                    <PriceVolumeChart
                        data={chartData.data}
                        ma5={chartData.ma5}
                        ma10={chartData.ma10}
                        ma20={chartData.ma20}
                        volumeMa20={chartData.volumeMa20}
                        ticker={chartData.ticker}
                        spikeMarkers={spikeMarkers}
                    />
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex-shrink-0" style={{ height: '300px' }}>
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 text-emerald-500 animate-spin" />
                        <h3 className="text-lg font-medium text-zinc-300 mb-2">
                            Fetching Data...
                        </h3>
                        <p className="text-sm text-zinc-500">
                            Retrieving price and volume data for {ticker}
                        </p>
                    </div>
                </div>
            ) : !error ? (
                <div className="flex items-center justify-center bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex-shrink-0" style={{ height: '200px' }}>
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-800/50 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-zinc-600" />
                        </div>
                        <h3 className="text-base font-medium text-zinc-400 mb-1">
                            No Chart Data
                        </h3>
                        <p className="text-sm text-zinc-600 max-w-sm">
                            Enter a ticker or click on an unusual volume alert below
                        </p>
                    </div>
                </div>
            ) : null}

            {/* Unusual Volume List - Always visible */}
            <div className="flex-shrink-0">
                <UnusualVolumeList
                    data={unusualVolumes}
                    isLoading={isLoadingUnusual}
                    onTickerClick={handleUnusualVolumeClick}
                />
            </div>
        </div>
    );
}
