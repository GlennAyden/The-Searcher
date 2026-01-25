'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, TrendingUp, Loader2, Database, TrendingDown, Minus, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { PriceVolumeChart } from '@/components/charts/PriceVolumeChart';
import { UnusualVolumeList } from '@/components/charts/UnusualVolumeList';
import { priceVolumeApi, PriceVolumeResponse, UnusualVolumeEvent, SpikeMarker, MarketCapResponse, RefreshAllResponse, HKAnalysisResponse } from '@/services/api/priceVolume';
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

    // Market cap state
    const [marketCapData, setMarketCapData] = useState<MarketCapResponse | null>(null);

    // Refresh all state
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshResult, setRefreshResult] = useState<RefreshAllResponse | null>(null);
    const [showRefreshResult, setShowRefreshResult] = useState(false);

    // HK Analysis state
    const [hkAnalysis, setHkAnalysis] = useState<HKAnalysisResponse | null>(null);
    const [isLoadingHK, setIsLoadingHK] = useState(false);

    // Handle refresh all tickers
    const handleRefreshAll = useCallback(async () => {
        setIsRefreshing(true);
        setRefreshResult(null);
        setShowRefreshResult(false);

        try {
            const result = await priceVolumeApi.refreshAllTickers();
            setRefreshResult(result);
            setShowRefreshResult(true);

            // Auto-hide result after 10 seconds
            setTimeout(() => setShowRefreshResult(false), 10000);
        } catch (err) {
            console.error('Failed to refresh all tickers:', err);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

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

            // Fetch market cap data
            try {
                const mcapResponse = await priceVolumeApi.getMarketCap(tickerSymbol);
                setMarketCapData(mcapResponse);
            } catch (err) {
                console.error('Failed to fetch market cap:', err);
                setMarketCapData(null);
            }

            // Fetch HK Analysis
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

                <div className="flex items-center gap-3">
                    {/* Refresh All Button */}
                    <button
                        onClick={handleRefreshAll}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isRefreshing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                Refresh All Data
                            </>
                        )}
                    </button>

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
            </div>

            {/* Refresh Result Notification */}
            {showRefreshResult && refreshResult && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${refreshResult.errors.length > 0
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                    <div className="flex items-center gap-3">
                        {refreshResult.errors.length > 0 ? (
                            <AlertCircle className="w-5 h-5 text-amber-400" />
                        ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        )}
                        <div>
                            <p className="text-sm font-medium text-zinc-100">
                                Refresh Complete
                            </p>
                            <p className="text-xs text-zinc-400">
                                {refreshResult.tickers_updated} of {refreshResult.tickers_processed} tickers updated •
                                {refreshResult.total_records_added} records added
                                {refreshResult.errors.length > 0 && (
                                    <span className="text-amber-400 ml-1">
                                        • {refreshResult.errors.length} errors
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowRefreshResult(false)}
                        className="text-zinc-500 hover:text-zinc-300 text-sm"
                    >
                        Dismiss
                    </button>
                </div>
            )}

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

            {/* Market Cap Stats Section - Before chart */}
            {marketCapData && marketCapData.current_market_cap && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-zinc-100">Market Capitalization</h3>
                        <span className="text-xs text-zinc-500">Based on {marketCapData.history_count} trading days</span>
                    </div>

                    {/* Stats Row - Compact */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Current Market Cap */}
                        <div className="bg-zinc-800/50 rounded-lg p-2.5">
                            <div className="text-xs text-zinc-500 mb-1">Current Market Cap</div>
                            <div className="text-lg font-bold text-cyan-400">
                                {marketCapData.current_market_cap >= 1e12
                                    ? `Rp ${(marketCapData.current_market_cap / 1e12).toFixed(1)}T`
                                    : marketCapData.current_market_cap >= 1e9
                                        ? `Rp ${(marketCapData.current_market_cap / 1e9).toFixed(1)}B`
                                        : `Rp ${(marketCapData.current_market_cap / 1e6).toFixed(1)}M`
                                }
                            </div>
                        </div>

                        {/* Shares Outstanding */}
                        {marketCapData.shares_outstanding && (
                            <div className="bg-zinc-800/50 rounded-lg p-2.5">
                                <div className="text-xs text-zinc-500 mb-1">Shares Outstanding</div>
                                <div className="text-base font-semibold text-zinc-100">
                                    {(marketCapData.shares_outstanding / 1e9).toFixed(2)}B
                                </div>
                            </div>
                        )}

                        {/* 7D Change */}
                        {marketCapData.change_7d_pct !== null && (
                            <div className="bg-zinc-800/50 rounded-lg p-2.5">
                                <div className="text-xs text-zinc-500 mb-1">7D Change</div>
                                <div className={`text-base font-semibold flex items-center gap-1 ${marketCapData.change_7d_pct > 0 ? 'text-emerald-400' :
                                    marketCapData.change_7d_pct < 0 ? 'text-red-400' : 'text-zinc-400'
                                    }`}>
                                    {marketCapData.change_7d_pct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
                                        marketCapData.change_7d_pct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
                                            <Minus className="w-3.5 h-3.5" />}
                                    {marketCapData.change_7d_pct > 0 ? '+' : ''}{marketCapData.change_7d_pct}%
                                </div>
                            </div>
                        )}

                        {/* 30D Change */}
                        {marketCapData.change_30d_pct !== null && (
                            <div className="bg-zinc-800/50 rounded-lg p-2.5">
                                <div className="text-xs text-zinc-500 mb-1">30D Change</div>
                                <div className={`text-base font-semibold flex items-center gap-1 ${marketCapData.change_30d_pct > 0 ? 'text-emerald-400' :
                                    marketCapData.change_30d_pct < 0 ? 'text-red-400' : 'text-zinc-400'
                                    }`}>
                                    {marketCapData.change_30d_pct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
                                        marketCapData.change_30d_pct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
                                            <Minus className="w-3.5 h-3.5" />}
                                    {marketCapData.change_30d_pct > 0 ? '+' : ''}{marketCapData.change_30d_pct}%
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Chart Section - Fixed height */}
            {chartData ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden flex-shrink-0" style={{ height: marketCapData?.history?.length ? '660px' : '520px' }}>
                    <PriceVolumeChart
                        data={chartData.data}
                        ma5={chartData.ma5}
                        ma10={chartData.ma10}
                        ma20={chartData.ma20}
                        volumeMa20={chartData.volumeMa20}
                        ticker={chartData.ticker}
                        spikeMarkers={spikeMarkers}
                        marketCapHistory={marketCapData?.history || []}
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

            {/* HK Methodology Analysis Panel */}
            {chartData && (hkAnalysis || isLoadingHK) && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">📊</span>
                            <h3 className="text-base font-semibold text-zinc-100">HK Methodology Analysis</h3>
                        </div>
                        {hkAnalysis && (
                            <span className="text-xs text-zinc-500">
                                Spike: {hkAnalysis.spike_date} ({hkAnalysis.spike_source === 'auto_detected' ? 'auto' : 'manual'})
                            </span>
                        )}
                    </div>

                    {isLoadingHK ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mr-2" />
                            <span className="text-zinc-400">Analyzing smart money patterns...</span>
                        </div>
                    ) : hkAnalysis ? (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Volume Asymmetry */}
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                                    Volume Asymmetry (Post-Spike)
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Vol on UP days</span>
                                        <span className="text-emerald-400">
                                            {(hkAnalysis.volume_asymmetry.volume_up_total / 1000000).toFixed(1)}M
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Vol on DOWN days</span>
                                        <span className="text-red-400">
                                            {(hkAnalysis.volume_asymmetry.volume_down_total / 1000000).toFixed(1)}M
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Asymmetry Ratio</span>
                                        <span className={`font-semibold ${hkAnalysis.volume_asymmetry.asymmetry_ratio >= 3 ? 'text-emerald-400' :
                                                hkAnalysis.volume_asymmetry.asymmetry_ratio >= 1 ? 'text-amber-400' : 'text-red-400'
                                            }`}>
                                            {hkAnalysis.volume_asymmetry.asymmetry_ratio.toFixed(1)}:1
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
                                        <span className="text-zinc-500">Bandar Status</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${hkAnalysis.volume_asymmetry.verdict === 'STRONG_HOLDING' ? 'bg-emerald-500/20 text-emerald-400' :
                                                hkAnalysis.volume_asymmetry.verdict === 'HOLDING' ? 'bg-cyan-500/20 text-cyan-400' :
                                                    hkAnalysis.volume_asymmetry.verdict === 'DISTRIBUTING' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-zinc-500/20 text-zinc-400'
                                            }`}>
                                            {hkAnalysis.volume_asymmetry.verdict}
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-600 text-center pt-1">
                                        {hkAnalysis.volume_asymmetry.days_analyzed} days analyzed
                                    </div>
                                </div>
                            </div>

                            {/* Pre-Spike Accumulation */}
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-zinc-400 uppercase mb-3 flex items-center gap-2">
                                    Pre-Spike Accumulation
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Period</span>
                                        <span className="text-zinc-300 text-xs">
                                            {hkAnalysis.accumulation.period_start?.slice(5) || 'N/A'} → {hkAnalysis.accumulation.period_end?.slice(5) || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Duration</span>
                                        <span className="text-zinc-300">{hkAnalysis.accumulation.accumulation_days} days</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Total Volume</span>
                                        <span className="text-cyan-400">
                                            {(hkAnalysis.accumulation.total_volume / 1000000).toFixed(1)}M
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Volume Trend</span>
                                        <span className={
                                            hkAnalysis.accumulation.volume_trend === 'INCREASING' ? 'text-emerald-400' :
                                                hkAnalysis.accumulation.volume_trend === 'DECREASING' ? 'text-red-400' : 'text-amber-400'
                                        }>
                                            {hkAnalysis.accumulation.volume_trend}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Up/Down Days</span>
                                        <span className="text-zinc-300">
                                            <span className="text-emerald-400">{hkAnalysis.accumulation.up_days}</span>
                                            {' / '}
                                            <span className="text-red-400">{hkAnalysis.accumulation.down_days}</span>
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Net Movement</span>
                                        <span className={hkAnalysis.accumulation.net_movement_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            {hkAnalysis.accumulation.net_movement_pct > 0 ? '+' : ''}{hkAnalysis.accumulation.net_movement_pct.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}

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
