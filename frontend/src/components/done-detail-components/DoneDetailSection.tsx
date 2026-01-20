'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Clipboard, Save, Trash2, Loader2, Check, X,
    RefreshCw, ChevronDown, AlertTriangle, TrendingUp, TrendingDown,
    Calendar, Users, Activity, ArrowRightLeft, ArrowUp, ArrowDown, Filter, Zap
} from "lucide-react";
import {
    doneDetailApi, SavedHistory, DateRangeInfo,
    ImposterAnalysis, TradeRecord, SpeedAnalysis, CombinedAnalysis
} from '@/services/api/doneDetail';
import { BrokerProfileModal } from './BrokerProfileModal';

interface DoneDetailSectionProps {
    ticker: string;
    onTickerChange?: (ticker: string) => void;
}

// Format value in Rupiah
const formatRupiah = (value: number): string => {
    if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `Rp ${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `Rp ${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `Rp ${(value / 1e3).toFixed(0)}K`;
    return `Rp ${value.toFixed(0)}`;
};

const formatLot = (value: number): string => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return `${value.toLocaleString()}`;
};

// Parse filter expression like ">1000", "<=500", "=100", "1000-2000"
const parseFilterExpr = (expr: string): ((value: number) => boolean) | null => {
    if (!expr.trim()) return null;
    const trimmed = expr.trim();

    // Range: "1000-2000"
    const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        return (v) => v >= min && v <= max;
    }

    // Operators: >=, <=, >, <, =
    const opMatch = trimmed.match(/^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?[KMBkmb]?)$/);
    if (opMatch) {
        const op = opMatch[1];
        let numStr = opMatch[2].toUpperCase();
        let multiplier = 1;
        if (numStr.endsWith('K')) { multiplier = 1e3; numStr = numStr.slice(0, -1); }
        else if (numStr.endsWith('M')) { multiplier = 1e6; numStr = numStr.slice(0, -1); }
        else if (numStr.endsWith('B')) { multiplier = 1e9; numStr = numStr.slice(0, -1); }
        const num = parseFloat(numStr) * multiplier;

        switch (op) {
            case '>=': return (v) => v >= num;
            case '<=': return (v) => v <= num;
            case '>': return (v) => v > num;
            case '<': return (v) => v < num;
            case '=': return (v) => v === num;
            default: return null;
        }
    }

    // Plain number
    const plainNum = parseFloat(trimmed);
    if (!isNaN(plainNum)) {
        return (v) => v === plainNum;
    }

    return null;
};

type SortConfig = {
    key: 'trade_time' | 'seller_code' | 'buyer_code' | 'qty' | 'price' | 'value';
    direction: 'asc' | 'desc';
} | null;

interface ColumnFilters {
    time: string;
    seller: string;
    buyer: string;
    lot: string;
    price: string;
    value: string;
}

export function DoneDetailSection({ ticker, onTickerChange }: DoneDetailSectionProps) {
    // Ticker and date state
    const [availableTickers, setAvailableTickers] = useState<string[]>([]);
    const [selectedTicker, setSelectedTicker] = useState(ticker || '');
    const [dateRangeInfo, setDateRangeInfo] = useState<DateRangeInfo | null>(null);
    const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [pasteTickerInput, setPasteTickerInput] = useState('');
    const [pasteDateInput, setPasteDateInput] = useState('');
    const [showTickerDropdown, setShowTickerDropdown] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Data state
    const [analysisData, setAnalysisData] = useState<ImposterAnalysis | null>(null);
    const [speedData, setSpeedData] = useState<SpeedAnalysis | null>(null);
    const [combinedData, setCombinedData] = useState<CombinedAnalysis | null>(null);

    // Filter and sort state
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<ColumnFilters>({ time: '', seller: '', buyer: '', lot: '', price: '', value: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<'overview' | 'imposter' | 'speed'>('overview');
    const [selectedBroker, setSelectedBroker] = useState<string | null>(null);

    // Load available tickers on mount
    useEffect(() => { loadTickers(); }, []);

    // Load date range when ticker changes
    useEffect(() => {
        if (selectedTicker) loadDateRange(selectedTicker);
    }, [selectedTicker]);

    // Load data when dates change
    useEffect(() => {
        if (selectedTicker && startDate && endDate) loadData();
    }, [selectedTicker, startDate, endDate]);

    // Handle date mode change
    useEffect(() => {
        if (dateMode === 'single' && startDate) setEndDate(startDate);
    }, [dateMode, startDate]);

    const loadTickers = async () => {
        try {
            const result = await doneDetailApi.getTickers();
            setAvailableTickers(result.tickers || []);
            if (!selectedTicker && result.tickers?.length > 0) {
                setSelectedTicker(result.tickers[0]);
            }
        } catch (error) { console.error('Error loading tickers:', error); }
    };

    const loadDateRange = async (ticker: string) => {
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
        } catch (error) { console.error('Error loading date range:', error); }
    };

    const loadData = async () => {
        if (!selectedTicker || !startDate || !endDate) return;
        setLoading(true);
        try {
            // Optimized: Fetch all data in one request to prevent server overload
            const combined = await doneDetailApi.getCombinedAnalysis(selectedTicker, startDate, endDate);

            setCombinedData(combined);

            if (combined.imposter_analysis) {
                setAnalysisData(combined.imposter_analysis);
            } else {
                // Fallback if backend doesn't return it (shouldn't happen with new backend)
                const imposter = await doneDetailApi.getImposterAnalysis(selectedTicker, startDate, endDate);
                setAnalysisData(imposter);
            }

            if (combined.speed_analysis) {
                setSpeedData(combined.speed_analysis);
            } else {
                // Fallback
                const speed = await doneDetailApi.getSpeedAnalysis(selectedTicker, startDate, endDate);
                setSpeedData(speed);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setMessage({ type: 'error', text: 'Failed to load data' });
        } finally { setLoading(false); }
    };

    const handleSave = async () => {
        if (!pasteTickerInput || !pasteDateInput || !pasteData) {
            setMessage({ type: 'error', text: 'Please fill ticker, date, and paste data' });
            return;
        }
        setSaving(true);
        try {
            const result = await doneDetailApi.saveData(pasteTickerInput, pasteDateInput, pasteData);
            if (result.success) {
                setMessage({ type: 'success', text: `Saved ${result.records_saved} records` });
                setShowPasteModal(false);
                setPasteData('');
                setPasteTickerInput('');
                setPasteDateInput('');
                await loadTickers();
                setSelectedTicker(pasteTickerInput.toUpperCase());
                setStartDate(pasteDateInput);
                setEndDate(pasteDateInput);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to save data' });
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!selectedTicker || !startDate) return;
        if (!confirm(`Delete data for ${selectedTicker} on ${startDate}?`)) return;
        try {
            await doneDetailApi.deleteData(selectedTicker, startDate);
            setMessage({ type: 'success', text: 'Data deleted' });
            setAnalysisData(null);
            await loadTickers();
            await loadDateRange(selectedTicker);
        } catch (error) { setMessage({ type: 'error', text: 'Failed to delete data' }); }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setPasteData(text);
        } catch (error) { setMessage({ type: 'error', text: 'Please allow clipboard access' }); }
    };

    const handleSort = (key: NonNullable<SortConfig>['key']) => {
        setSortConfig(prev => {
            if (prev && prev.key === key) {
                return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const clearFilters = () => {
        setFilters({ time: '', seller: '', buyer: '', lot: '', price: '', value: '' });
        setSortConfig(null);
    };

    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(t);
        }
    }, [message]);

    // Filtered and sorted trades
    const displayedTrades = useMemo(() => {
        if (!analysisData?.all_trades) return [];

        // Always show imposter trades only
        let trades = analysisData.all_trades.filter(t => t.is_imposter);

        // Apply column filters
        if (filters.time) {
            const f = filters.time.toLowerCase();
            trades = trades.filter(t => t.trade_time.toLowerCase().includes(f));
        }
        if (filters.seller) {
            const f = filters.seller.toUpperCase();
            trades = trades.filter(t => t.seller_code.toUpperCase().includes(f));
        }
        if (filters.buyer) {
            const f = filters.buyer.toUpperCase();
            trades = trades.filter(t => t.buyer_code.toUpperCase().includes(f));
        }
        if (filters.lot) {
            const filterFn = parseFilterExpr(filters.lot);
            if (filterFn) trades = trades.filter(t => filterFn(t.qty));
        }
        if (filters.price) {
            const filterFn = parseFilterExpr(filters.price);
            if (filterFn) trades = trades.filter(t => filterFn(t.price));
        }
        if (filters.value) {
            const filterFn = parseFilterExpr(filters.value);
            if (filterFn) trades = trades.filter(t => filterFn(t.value));
        }

        // Apply sorting
        if (sortConfig) {
            trades.sort((a, b) => {
                let aVal: any = a[sortConfig.key];
                let bVal: any = b[sortConfig.key];

                // String comparison for codes
                if (typeof aVal === 'string') {
                    return sortConfig.direction === 'asc'
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                }

                // Number comparison
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        return trades;
    }, [analysisData, filters, sortConfig]);

    const SortIcon = ({ column }: { column: NonNullable<SortConfig>['key'] }) => {
        if (!sortConfig || sortConfig.key !== column) return <ArrowDown className="w-3 h-3 opacity-30" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3 text-teal-400" />
            : <ArrowDown className="w-3 h-3 text-teal-400" />;
    };

    const hasActiveFilters = Object.values(filters).some(f => f) || sortConfig !== null;

    return (
        <div className="space-y-3">
            {/* Header */}
            <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Ticker Selector */}
                        <div className="relative">
                            <Button
                                variant="outline"
                                className="w-28 justify-between bg-slate-800 border-slate-600 text-white font-bold"
                                onClick={() => setShowTickerDropdown(!showTickerDropdown)}
                            >
                                {selectedTicker || 'Select'}
                                <ChevronDown className="w-4 h-4 ml-1" />
                            </Button>
                            {showTickerDropdown && (
                                <div className="absolute top-full mt-1 w-28 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-auto">
                                    {availableTickers.length === 0 ? (
                                        <div className="p-2 text-slate-400 text-xs">No data yet</div>
                                    ) : (
                                        availableTickers.map((t) => (
                                            <button
                                                key={t}
                                                className={`w-full p-2 text-left hover:bg-slate-700 text-sm font-medium ${t === selectedTicker ? 'bg-teal-600 text-white' : 'text-white'}`}
                                                onClick={() => { setSelectedTicker(t); setShowTickerDropdown(false); }}
                                            >
                                                {t}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Date Mode Toggle */}
                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-lg">
                            <button
                                className={`px-2 py-1 text-xs rounded ${dateMode === 'single' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}
                                onClick={() => setDateMode('single')}
                            >Single</button>
                            <button
                                className={`px-2 py-1 text-xs rounded ${dateMode === 'range' ? 'bg-teal-600 text-white' : 'text-slate-400'}`}
                                onClick={() => setDateMode('range')}
                            >Range</button>
                        </div>

                        {/* Date Picker(s) */}
                        {dateRangeInfo?.dates && dateRangeInfo.dates.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <select
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); if (dateMode === 'single') setEndDate(e.target.value); }}
                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                                >
                                    {dateRangeInfo.dates.map((d) => (<option key={d} value={d}>{d}</option>))}
                                </select>
                                {dateMode === 'range' && (
                                    <>
                                        <span className="text-slate-500 text-xs">to</span>
                                        <select value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white">
                                            {dateRangeInfo.dates.map((d) => (<option key={d} value={d}>{d}</option>))}
                                        </select>
                                    </>
                                )}
                            </div>
                        ) : selectedTicker ? (<span className="text-slate-500 text-xs">No dates available</span>) : null}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 ml-auto">
                            <Button variant="outline" size="sm" onClick={() => setShowPasteModal(true)}
                                className="border-teal-500 text-teal-400 hover:bg-teal-500/20 h-7 text-xs">
                                <Clipboard className="w-3 h-3 mr-1" />Paste New
                            </Button>
                            {analysisData && (
                                <>
                                    <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="border-slate-600 h-7">
                                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleDelete} className="border-red-500 text-red-400 h-7">
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    {message && (
                        <div className={`mt-2 p-1.5 rounded text-xs ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {message.text}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-80"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /></div>
            ) : analysisData ? (
                <div className="space-y-3">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="bg-slate-900/50 border-slate-700">
                            <CardContent className="py-3 px-4 text-center">
                                <div className="text-2xl font-black text-white">{analysisData.total_transactions.toLocaleString()}</div>
                                <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                    <Activity className="w-3 h-3" />Total Transaksi
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-900/50 border-slate-700">
                            <CardContent className="py-3 px-4 text-center">
                                <div className="text-2xl font-black text-teal-400">{formatLot(analysisData.summary.total_lot)}</div>
                                <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                    <ArrowRightLeft className="w-3 h-3" />Total Lot
                                </div>
                            </CardContent>
                        </Card>
                        <Card className={`${analysisData.imposter_count > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                            <CardContent className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-lg font-black text-red-500">{analysisData.summary.strong_count || 0}</span>
                                    <span className="text-slate-500">/</span>
                                    <span className="text-lg font-black text-orange-400">{analysisData.summary.possible_count || 0}</span>
                                </div>
                                <div className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />Strong/Possible
                                </div>
                            </CardContent>
                        </Card>
                        <Card className={`${analysisData.summary.imposter_percentage > 5 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                            <CardContent className="py-3 px-4 text-center">
                                <div className="text-xs text-slate-500 mb-1">
                                    P95: {analysisData.thresholds?.p95 || 0} | P99: {analysisData.thresholds?.p99 || 0} lot
                                </div>
                                <div className="text-xl font-black text-orange-400">{analysisData.summary.imposter_percentage.toFixed(1)}%</div>
                                <div className="text-xs text-slate-400">Imposter Value %</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Imposter Summary by Broker */}
                    {analysisData.by_broker.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            <span className="text-xs text-slate-500">Imposter Brokers:</span>
                            {analysisData.by_broker.map((b) => (
                                <div key={b.broker} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs">
                                    <span className="font-bold text-red-400">{b.broker}</span>
                                    <span className="text-slate-400 mx-1">•</span>
                                    <span className="text-red-500">{b.strong_count || 0}S</span>
                                    <span className="text-slate-500">/</span>
                                    <span className="text-orange-400">{b.possible_count || 0}P</span>
                                    <span className="text-slate-400 mx-1">•</span>
                                    <span className="text-teal-400">{formatRupiah(b.total_value)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center gap-1 border-b border-slate-700 pb-1">
                        {[
                            { id: 'overview', label: '📊 Overview', active: true },
                            { id: 'imposter', label: '🎭 Imposter', active: true },
                            { id: 'speed', label: '⚡ Speed', active: true },
                        ].map((tab) => (
                            <button key={tab.id}
                                className={`px-3 py-1.5 text-xs rounded-t ${activeTab === tab.id
                                    ? 'bg-slate-800 text-teal-400 border border-b-0 border-slate-600'
                                    : 'text-slate-500 hover:text-slate-300'} ${!tab.active ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => {
                                    if (tab.active) {
                                        setActiveTab(tab.id as any);
                                    }
                                }}
                                disabled={!tab.active}
                            >{tab.label}</button>
                        ))}

                        {/* Filter Toggle */}
                        <div className="ml-auto flex items-center gap-2">
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs text-slate-400 hover:text-white">
                                    <X className="w-3 h-3 mr-1" />Clear
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`h-6 text-xs ${showFilters ? 'border-teal-500 text-teal-400' : 'border-slate-600 text-slate-400'}`}
                            >
                                <Filter className="w-3 h-3 mr-1" />Filter
                            </Button>
                        </div>
                    </div>

                    {/* Overview Dashboard */}
                    {activeTab === 'overview' && combinedData && (
                        <div className="space-y-4">
                            {/* Signal Strength Hero */}
                            <Card className={`border-2 ${combinedData.signal.direction === 'BULLISH'
                                ? 'bg-gradient-to-r from-green-900/30 to-green-800/10 border-green-500/50'
                                : combinedData.signal.direction === 'BEARISH'
                                    ? 'bg-gradient-to-r from-red-900/30 to-red-800/10 border-red-500/50'
                                    : 'bg-slate-900/50 border-slate-600'
                                }`}>
                                <CardContent className="py-6 px-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`text-5xl ${combinedData.signal.direction === 'BULLISH' ? 'text-green-400'
                                                : combinedData.signal.direction === 'BEARISH' ? 'text-red-400'
                                                    : 'text-slate-400'
                                                }`}>
                                                {combinedData.signal.direction === 'BULLISH' ? '📈' : combinedData.signal.direction === 'BEARISH' ? '📉' : '➖'}
                                            </div>
                                            <div>
                                                <div className={`text-3xl font-black ${combinedData.signal.direction === 'BULLISH' ? 'text-green-400'
                                                    : combinedData.signal.direction === 'BEARISH' ? 'text-red-400'
                                                        : 'text-slate-400'
                                                    }`}>
                                                    {combinedData.signal.description}
                                                </div>
                                                <div className="text-sm text-slate-400 mt-1">
                                                    Based on Impostor Flow + Speed Analysis
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-4xl font-black text-white">
                                                {combinedData.signal.confidence}%
                                            </div>
                                            <div className="text-xs text-slate-400">Confidence</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Key Metrics Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Card className="bg-slate-900/50 border-slate-700">
                                    <CardContent className="py-3 px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-lg font-black text-red-500">{combinedData.key_metrics.strong_impostor_count}</span>
                                            <span className="text-slate-500">/</span>
                                            <span className="text-lg font-black text-orange-400">{combinedData.key_metrics.possible_impostor_count}</span>
                                        </div>
                                        <div className="text-xs text-slate-400">Strong / Possible Impostor</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-700">
                                    <CardContent className="py-3 px-4 text-center">
                                        <div className="text-2xl font-black text-teal-400">{combinedData.key_metrics.avg_tps}</div>
                                        <div className="text-xs text-slate-400">Avg Trades/Sec</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-700">
                                    <CardContent className="py-3 px-4 text-center">
                                        <div className="text-2xl font-black text-yellow-400">{combinedData.key_metrics.burst_count}</div>
                                        <div className="text-xs text-slate-400">Burst Events</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-700">
                                    <CardContent className="py-3 px-4 text-center">
                                        <div className="text-2xl font-black text-white">{combinedData.key_metrics.total_trades.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">Total Trades</div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Impostor Flow */}
                            <Card className="bg-slate-900/50 border-slate-700">
                                <CardHeader className="py-2 px-4">
                                    <CardTitle className="text-sm text-teal-400">💰 Impostor Flow (Smart Money Direction)</CardTitle>
                                </CardHeader>
                                <CardContent className="py-4 px-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                <span>BUY {combinedData.impostor_flow.buy_pct.toFixed(1)}%</span>
                                                <span>SELL {combinedData.impostor_flow.sell_pct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-6 bg-slate-800 rounded-full overflow-hidden flex">
                                                <div
                                                    className="bg-gradient-to-r from-green-600 to-green-400 h-full transition-all"
                                                    style={{ width: `${combinedData.impostor_flow.buy_pct}%` }}
                                                />
                                                <div
                                                    className="bg-gradient-to-r from-red-400 to-red-600 h-full transition-all"
                                                    style={{ width: `${combinedData.impostor_flow.sell_pct}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs mt-1">
                                                <span className="text-green-400 font-bold">{formatRupiah(combinedData.impostor_flow.buy_value)} ({combinedData.impostor_flow.buy_count})</span>
                                                <span className="text-red-400 font-bold">{formatRupiah(combinedData.impostor_flow.sell_value)} ({combinedData.impostor_flow.sell_count})</span>
                                            </div>
                                        </div>
                                        <div className="text-center px-4 border-l border-slate-700">
                                            <div className={`text-xl font-black ${combinedData.impostor_flow.net_value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {combinedData.impostor_flow.net_value >= 0 ? '+' : ''}{formatRupiah(combinedData.impostor_flow.net_value)}
                                            </div>
                                            <div className="text-xs text-slate-400">Net Flow</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Power Brokers */}
                            {combinedData.power_brokers.length > 0 && (
                                <Card className="bg-slate-900/50 border-slate-700">
                                    <CardHeader className="py-2 px-4">
                                        <CardTitle className="text-sm text-purple-400">⚡ Power Brokers (Top Impostor + Speed)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2 px-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {combinedData.power_brokers.slice(0, 6).map((broker) => (
                                                <div
                                                    key={broker.broker_code}
                                                    onClick={() => setSelectedBroker(broker.broker_code)}
                                                    className={`p-3 rounded-lg border cursor-pointer hover:scale-105 transition-transform ${broker.net_direction === 'BUY'
                                                        ? 'bg-green-900/20 border-green-500/30'
                                                        : 'bg-red-900/20 border-red-500/30'
                                                        }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-bold text-white">{broker.broker_code}</span>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${broker.net_direction === 'BUY'
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {broker.net_direction === 'BUY' ? '↑' : '↓'} {broker.net_direction}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-400 mb-1">{broker.broker_name}</div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-slate-500">Impostor:</span>
                                                            <span className="text-teal-400 ml-1">{formatRupiah(broker.impostor_value)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">Speed:</span>
                                                            <span className="text-yellow-400 ml-1">{broker.speed_trades} trades</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-red-500">{broker.strong_count}S</span>
                                                            <span className="text-slate-500">/</span>
                                                            <span className="text-orange-400">{broker.possible_count}P</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">TPS:</span>
                                                            <span className="text-blue-400 ml-1">{broker.speed_tps}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Quick Navigation */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActiveTab('imposter')}
                                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                                >
                                    🎭 View Impostor Details
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActiveTab('speed')}
                                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                                >
                                    ⚡ View Speed Details
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Imposter Trades Table */}
                    {activeTab === 'imposter' && (
                        <div className="space-y-3">
                            {/* BUY/SELL/Net Flow Summary */}
                            {analysisData && analysisData.imposter_trades.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* BUY Summary */}
                                    <Card className="bg-gradient-to-br from-green-900/30 to-green-800/10 border-green-500/30">
                                        <CardContent className="py-4 px-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-green-400 font-bold">📈 BUY IMPOSTOR</span>
                                                <ArrowUp className="w-4 h-4 text-green-400" />
                                            </div>
                                            <div className="text-2xl font-black text-green-400 mb-1">
                                                {formatRupiah(
                                                    analysisData.imposter_trades
                                                        .filter(t => t.direction === 'BUY')
                                                        .reduce((sum, t) => sum + t.value, 0)
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {analysisData.imposter_trades.filter(t => t.direction === 'BUY').length} trades
                                                {' '}•{' '}
                                                <span className="text-red-400">
                                                    {analysisData.imposter_trades.filter(t => t.direction === 'BUY' && t.level === 'STRONG').length}S
                                                </span>
                                                /
                                                <span className="text-orange-400">
                                                    {analysisData.imposter_trades.filter(t => t.direction === 'BUY' && t.level === 'POSSIBLE').length}P
                                                </span>
                                            </div>
                                            {(() => {
                                                const buyTrades = analysisData.imposter_trades.filter(t => t.direction === 'BUY');
                                                if (buyTrades.length > 0) {
                                                    const topBroker = buyTrades.reduce((max, t) =>
                                                        (max.value || 0) < t.value ? t : max
                                                    );
                                                    return (
                                                        <div className="text-xs text-green-300 mt-1">
                                                            Top: {topBroker.broker_code}
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </CardContent>
                                    </Card>

                                    {/* SELL Summary */}
                                    <Card className="bg-gradient-to-br from-red-900/30 to-red-800/10 border-red-500/30">
                                        <CardContent className="py-4 px-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-red-400 font-bold">📉 SELL IMPOSTOR</span>
                                                <ArrowDown className="w-4 h-4 text-red-400" />
                                            </div>
                                            <div className="text-2xl font-black text-red-400 mb-1">
                                                {formatRupiah(
                                                    analysisData.imposter_trades
                                                        .filter(t => t.direction === 'SELL')
                                                        .reduce((sum, t) => sum + t.value, 0)
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {analysisData.imposter_trades.filter(t => t.direction === 'SELL').length} trades
                                                {' '}•{' '}
                                                <span className="text-red-400">
                                                    {analysisData.imposter_trades.filter(t => t.direction === 'SELL' && t.level === 'STRONG').length}S
                                                </span>
                                                /
                                                <span className="text-orange-400">
                                                    {analysisData.imposter_trades.filter(t => t.direction === 'SELL' && t.level === 'POSSIBLE').length}P
                                                </span>
                                            </div>
                                            {(() => {
                                                const sellTrades = analysisData.imposter_trades.filter(t => t.direction === 'SELL');
                                                if (sellTrades.length > 0) {
                                                    const topBroker = sellTrades.reduce((max, t) =>
                                                        (max.value || 0) < t.value ? t : max
                                                    );
                                                    return (
                                                        <div className="text-xs text-red-300 mt-1">
                                                            Top: {topBroker.broker_code}
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </CardContent>
                                    </Card>

                                    {/* Net Flow */}
                                    <Card className={`${(() => {
                                        const buyValue = analysisData.imposter_trades.filter(t => t.direction === 'BUY').reduce((sum, t) => sum + t.value, 0);
                                        const sellValue = analysisData.imposter_trades.filter(t => t.direction === 'SELL').reduce((sum, t) => sum + t.value, 0);
                                        const netValue = buyValue - sellValue;
                                        return netValue > 0
                                            ? 'bg-gradient-to-br from-teal-900/30 to-teal-800/10 border-teal-500/30'
                                            : netValue < 0
                                                ? 'bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-500/30'
                                                : 'bg-slate-900/50 border-slate-700';
                                    })()}`}>
                                        <CardContent className="py-4 px-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-teal-400 font-bold">💰 NET FLOW</span>
                                                {(() => {
                                                    const buyValue = analysisData.imposter_trades.filter(t => t.direction === 'BUY').reduce((sum, t) => sum + t.value, 0);
                                                    const sellValue = analysisData.imposter_trades.filter(t => t.direction === 'SELL').reduce((sum, t) => sum + t.value, 0);
                                                    const netValue = buyValue - sellValue;
                                                    return netValue > 0
                                                        ? <TrendingUp className="w-4 h-4 text-green-400" />
                                                        : netValue < 0
                                                            ? <TrendingDown className="w-4 h-4 text-red-400" />
                                                            : <ArrowRightLeft className="w-4 h-4 text-slate-400" />;
                                                })()}
                                            </div>
                                            <div className={`text-2xl font-black mb-1 ${(() => {
                                                const buyValue = analysisData.imposter_trades.filter(t => t.direction === 'BUY').reduce((sum, t) => sum + t.value, 0);
                                                const sellValue = analysisData.imposter_trades.filter(t => t.direction === 'SELL').reduce((sum, t) => sum + t.value, 0);
                                                const netValue = buyValue - sellValue;
                                                return netValue > 0 ? 'text-green-400' : netValue < 0 ? 'text-red-400' : 'text-slate-400';
                                            })()}`}>
                                                {(() => {
                                                    const buyValue = analysisData.imposter_trades.filter(t => t.direction === 'BUY').reduce((sum, t) => sum + t.value, 0);
                                                    const sellValue = analysisData.imposter_trades.filter(t => t.direction === 'SELL').reduce((sum, t) => sum + t.value, 0);
                                                    const netValue = buyValue - sellValue;
                                                    return (netValue >= 0 ? '+' : '') + formatRupiah(netValue);
                                                })()}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {(() => {
                                                    const buyValue = analysisData.imposter_trades.filter(t => t.direction === 'BUY').reduce((sum, t) => sum + t.value, 0);
                                                    const sellValue = analysisData.imposter_trades.filter(t => t.direction === 'SELL').reduce((sum, t) => sum + t.value, 0);
                                                    const totalValue = buyValue + sellValue;
                                                    if (totalValue === 0) return 'Neutral';
                                                    const netValue = buyValue - sellValue;
                                                    const percentage = ((Math.abs(netValue) / totalValue) * 100).toFixed(1);
                                                    return netValue > 0
                                                        ? `${percentage}% BUY dominance`
                                                        : `${percentage}% SELL dominance`;
                                                })()}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* Broker Heatmap Cards */}
                            {analysisData && analysisData.by_broker.length > 0 && (
                                <Card className="bg-slate-900/50 border-slate-700">
                                    <CardHeader className="py-2 px-4">
                                        <CardTitle className="text-sm text-purple-400">🏆 Top Impostor Brokers (Ranked by Value)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2 px-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {analysisData.by_broker.slice(0, 9).map((broker, index) => {
                                                const buyTrades = analysisData.imposter_trades.filter(
                                                    t => t.broker_code === broker.broker && t.direction === 'BUY'
                                                );
                                                const sellTrades = analysisData.imposter_trades.filter(
                                                    t => t.broker_code === broker.broker && t.direction === 'SELL'
                                                );
                                                const buyValue = buyTrades.reduce((sum, t) => sum + t.value, 0);
                                                const sellValue = sellTrades.reduce((sum, t) => sum + t.value, 0);
                                                const isBuyDominant = buyValue > sellValue;

                                                return (
                                                    <div
                                                        key={broker.broker}
                                                        onClick={() => setSelectedBroker(broker.broker)}
                                                        className={`p-3 rounded-lg border ${isBuyDominant
                                                            ? 'bg-green-900/20 border-green-500/30'
                                                            : 'bg-red-900/20 border-red-500/30'
                                                            } hover:scale-105 transition-transform cursor-pointer`}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                {index < 3 && (
                                                                    <span className="text-lg">
                                                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                                                    </span>
                                                                )}
                                                                <span className="font-bold text-white">{broker.broker}</span>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${isBuyDominant
                                                                ? 'bg-green-500/20 text-green-400'
                                                                : 'bg-red-500/20 text-red-400'
                                                                }`}>
                                                                {isBuyDominant ? '↑ BUY' : '↓ SELL'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-400 mb-2">{broker.name}</div>
                                                        <div className="text-sm font-bold text-teal-400 mb-2">
                                                            {formatRupiah(broker.total_value)}
                                                        </div>

                                                        {/* BUY/SELL Balance Bar */}
                                                        <div className="mb-2">
                                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                                <span>BUY</span>
                                                                <span>SELL</span>
                                                            </div>
                                                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                                                <div
                                                                    className="bg-green-500 h-full transition-all"
                                                                    style={{
                                                                        width: `${broker.total_value > 0 ? (buyValue / broker.total_value * 100) : 0}%`
                                                                    }}
                                                                />
                                                                <div
                                                                    className="bg-red-500 h-full transition-all"
                                                                    style={{
                                                                        width: `${broker.total_value > 0 ? (sellValue / broker.total_value * 100) : 0}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span className="text-slate-500">Trades:</span>
                                                                <span className="text-white ml-1">{broker.count}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-red-500">{broker.strong_count}S</span>
                                                                <span className="text-slate-500">/</span>
                                                                <span className="text-orange-400">{broker.possible_count}P</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="bg-slate-900/80 border-slate-700">
                                <CardHeader className="py-2 px-4 border-b border-slate-700">
                                    <CardTitle className="text-sm flex items-center gap-2 text-teal-400">
                                        <AlertTriangle className="w-4 h-4" />Imposter Trades (Top 1-5% Lot dari Broker Retail/Mixed)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {displayedTrades.length > 0 || showFilters ? (
                                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                            <table className="w-full text-xs">
                                                <thead className="sticky top-0 bg-slate-800 z-10">
                                                    <tr className="border-b border-slate-700 text-slate-400">
                                                        <th className="text-left py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('trade_time')}>
                                                            <div className="flex items-center gap-1">Time <SortIcon column="trade_time" /></div>
                                                        </th>
                                                        <th className="text-left py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('seller_code')}>
                                                            <div className="flex items-center gap-1">Seller <SortIcon column="seller_code" /></div>
                                                        </th>
                                                        <th className="text-center py-2 px-2">→</th>
                                                        <th className="text-left py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('buyer_code')}>
                                                            <div className="flex items-center gap-1">Buyer <SortIcon column="buyer_code" /></div>
                                                        </th>
                                                        <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('qty')}>
                                                            <div className="flex items-center justify-end gap-1">Lot <SortIcon column="qty" /></div>
                                                        </th>
                                                        <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('price')}>
                                                            <div className="flex items-center justify-end gap-1">Price <SortIcon column="price" /></div>
                                                        </th>
                                                        <th className="text-right py-2 px-2 cursor-pointer hover:text-white" onClick={() => handleSort('value')}>
                                                            <div className="flex items-center justify-end gap-1">Value <SortIcon column="value" /></div>
                                                        </th>
                                                        <th className="text-center py-2 px-2">Status</th>
                                                    </tr>
                                                    {showFilters && (
                                                        <tr className="border-b border-slate-600 bg-slate-800/80">
                                                            <td className="py-1 px-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder="hh:mm"
                                                                    value={filters.time}
                                                                    onChange={(e) => setFilters(f => ({ ...f, time: e.target.value }))}
                                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Code"
                                                                    value={filters.seller}
                                                                    onChange={(e) => setFilters(f => ({ ...f, seller: e.target.value }))}
                                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white uppercase"
                                                                />
                                                            </td>
                                                            <td></td>
                                                            <td className="py-1 px-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Code"
                                                                    value={filters.buyer}
                                                                    onChange={(e) => setFilters(f => ({ ...f, buyer: e.target.value }))}
                                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white uppercase"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder=">1000"
                                                                    value={filters.lot}
                                                                    onChange={(e) => setFilters(f => ({ ...f, lot: e.target.value }))}
                                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-right"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder=">1000"
                                                                    value={filters.price}
                                                                    onChange={(e) => setFilters(f => ({ ...f, price: e.target.value }))}
                                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-right"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-1">
                                                                <input
                                                                    type="text"
                                                                    placeholder=">1B"
                                                                    value={filters.value}
                                                                    onChange={(e) => setFilters(f => ({ ...f, value: e.target.value }))}
                                                                    className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-right"
                                                                />
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    )}
                                                </thead>
                                                <tbody>
                                                    {displayedTrades.map((trade, i) => (
                                                        <tr key={i} className={`border-b border-slate-800 hover:bg-slate-800/50 ${trade.is_imposter ? 'bg-red-500/5' : ''}`}>
                                                            <td className="py-2 px-2 text-slate-400 font-mono">{trade.trade_time}</td>
                                                            <td className="py-2 px-2">
                                                                <span className={`font-bold ${trade.imposter_side === 'SELL' || trade.imposter_side === 'BOTH' ? 'text-red-400' : 'text-white'}`}>
                                                                    {trade.seller_code}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-2 text-center text-slate-600">→</td>
                                                            <td className="py-2 px-2">
                                                                <span className={`font-bold ${trade.imposter_side === 'BUY' || trade.imposter_side === 'BOTH' ? 'text-green-400' : 'text-white'}`}>
                                                                    {trade.buyer_code}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-2 text-right font-mono text-white">{formatLot(trade.qty)}</td>
                                                            <td className="py-2 px-2 text-right font-mono text-slate-300">{trade.price.toLocaleString()}</td>
                                                            <td className="py-2 px-2 text-right font-mono text-teal-400">{formatRupiah(trade.value)}</td>
                                                            <td className="py-2 px-2 text-center">
                                                                {trade.is_imposter ? (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                                                                        🎭 {trade.imposter_side}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-600">-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {displayedTrades.length === 0 && showFilters && (
                                                <div className="text-center py-8 text-slate-400">
                                                    <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">No trades match your filters</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-400">
                                            <Check className="w-10 h-10 mx-auto mb-2 text-green-500" />
                                            <p className="font-medium">No Imposter Transactions</p>
                                            <p className="text-xs mt-1">No retail/mixed broker transactions in top 5% lot size</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}



                    {/* Speed Tab Content */}
                    {activeTab === 'speed' && speedData && (
                        <Card className="bg-slate-900/80 border-slate-700">
                            <CardHeader className="py-2 px-4 border-b border-slate-700">
                                <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
                                    ⚡ Speed Analysis - Trades Per Second & Burst Detection
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                {/* Speed Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <div className="text-xl font-bold text-white">{speedData.summary.total_trades.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">Total Trades</div>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <div className="text-xl font-bold text-blue-400">{speedData.summary.unique_seconds.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">Unique Seconds</div>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <div className="text-xl font-bold text-teal-400">{speedData.summary.avg_trades_per_second}</div>
                                        <div className="text-xs text-slate-400">Avg/Second</div>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <div className="text-xl font-bold text-yellow-400">{speedData.summary.max_trades_per_second}</div>
                                        <div className="text-xs text-slate-400">Max/Second</div>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3 text-center">
                                        <div className="text-lg font-bold text-orange-400 font-mono">{speedData.summary.peak_time || '-'}</div>
                                        <div className="text-xs text-slate-400">Peak Time</div>
                                    </div>
                                </div>

                                {/* Burst Events Visualization */}
                                {speedData.burst_events.length > 0 && (
                                    <div className="mb-6">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="text-sm text-orange-400 font-bold">🔥 Burst Activity Timeline</div>
                                            <div className="text-xs text-slate-500">(Moments with {'>'}10 trades/sec)</div>
                                        </div>
                                        <div className="relative pt-4 pb-2 px-2 overflow-x-auto">
                                            {/* Timeline Line */}
                                            <div className="absolute top-[28px] left-0 right-0 h-0.5 bg-gradient-to-r from-slate-800 via-orange-900/50 to-slate-800" />

                                            <div className="flex gap-4 relative z-10 min-w-max pb-2">
                                                {speedData.burst_events.slice(0, 15).map((burst, i) => {
                                                    // Calculate intensity (1-3 scale based on trade count)
                                                    const intensity = burst.trade_count > 30 ? 3 : burst.trade_count > 15 ? 2 : 1;
                                                    const sizeClass = intensity === 3 ? "w-8 h-8" : intensity === 2 ? "w-6 h-6" : "w-4 h-4";
                                                    const colorClass = intensity === 3 ? "bg-red-500" : intensity === 2 ? "bg-orange-500" : "bg-yellow-500";
                                                    const glowClass = intensity === 3 ? "shadow-[0_0_15px_rgba(239,68,68,0.6)]" : "shadow-[0_0_10px_rgba(249,115,22,0.4)]";

                                                    return (
                                                        <div key={i} className="flex flex-col items-center group cursor-pointer relative top-[2px]">
                                                            {/* Time Label - Top */}
                                                            <div className="text-[10px] font-mono text-slate-500 mb-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                                                {burst.trade_time}
                                                            </div>

                                                            {/* Node */}
                                                            <div className={`${sizeClass} ${colorClass} rounded-full border-2 border-slate-900 ${glowClass} flex items-center justify-center transition-transform group-hover:scale-125 z-10`}>
                                                                {intensity >= 2 && <Zap className="w-3 h-3 text-white fill-white" />}
                                                            </div>

                                                            {/* Count Label - Bottom */}
                                                            <div className="mt-2 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity absolute top-full">
                                                                <span className="font-bold text-orange-400">{burst.trade_count} trades</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {speedData.burst_events.length > 15 && (
                                                    <div className="flex items-center justify-center self-center ml-2">
                                                        <span className="text-xs text-slate-500 font-mono">+{speedData.burst_events.length - 15} more</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Broker Speed Ranking */}
                                <div className="text-sm text-purple-400 mb-3 font-bold">🏆 Top Speed Brokers (Ranked by Trade Count)</div>
                                {speedData.speed_by_broker.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {speedData.speed_by_broker.slice(0, 9).map((broker, index) => {
                                            const isBuyDominant = broker.buy_trades > broker.sell_trades;
                                            const buyPct = broker.total_trades > 0 ? (broker.buy_trades / broker.total_trades * 100) : 0;
                                            const sellPct = broker.total_trades > 0 ? (broker.sell_trades / broker.total_trades * 100) : 0;

                                            return (
                                                <div
                                                    key={broker.broker}
                                                    onClick={() => setSelectedBroker(broker.broker)}
                                                    className={`p-3 rounded-lg border ${isBuyDominant
                                                        ? 'bg-green-900/20 border-green-500/30'
                                                        : 'bg-red-900/20 border-red-500/30'
                                                        } hover:scale-105 transition-transform cursor-pointer`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {index < 3 && (
                                                                <span className="text-lg">
                                                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                                                </span>
                                                            )}
                                                            <span className="font-bold text-white">{broker.broker}</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isBuyDominant
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {isBuyDominant ? '↑ BUY' : '↓ SELL'}
                                                        </span>
                                                    </div>

                                                    <div className="text-xs text-slate-400 mb-2">{broker.name}</div>

                                                    {/* Total Trades & TPS */}
                                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                                        <div>
                                                            <div className="text-xl font-black text-yellow-400">
                                                                {broker.total_trades.toLocaleString()}
                                                            </div>
                                                            <div className="text-xs text-slate-500">Total Trades</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xl font-black text-teal-400">
                                                                {broker.trades_per_second}
                                                            </div>
                                                            <div className="text-xs text-slate-500">TPS</div>
                                                        </div>
                                                    </div>

                                                    {/* BUY/SELL Balance Bar */}
                                                    <div className="mb-2">
                                                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                            <span>BUY {buyPct.toFixed(0)}%</span>
                                                            <span>SELL {sellPct.toFixed(0)}%</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                                            <div
                                                                className="bg-green-500 h-full transition-all"
                                                                style={{ width: `${buyPct}%` }}
                                                            />
                                                            <div
                                                                className="bg-red-500 h-full transition-all"
                                                                style={{ width: `${sellPct}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-xs mt-1">
                                                            <span className="text-green-400">{broker.buy_trades.toLocaleString()}</span>
                                                            <span className="text-red-400">{broker.sell_trades.toLocaleString()}</span>
                                                        </div>
                                                    </div>

                                                    {/* Additional Stats */}
                                                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-700">
                                                        <div>
                                                            <span className="text-slate-500">Value:</span>
                                                            <span className="text-teal-400 ml-1">{formatRupiah(broker.total_value)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">Active:</span>
                                                            <span className="text-blue-400 ml-1">{broker.seconds_active}s</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        <Activity className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                                        <p className="font-medium">No Speed Data</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            ) : availableTickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Clipboard className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">No Done Detail data yet</p>
                    <p className="text-xs text-slate-500 mt-1">Click "Paste New" to add data</p>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <Calendar className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">Select a date to view analysis</p>
                </div>
            )}

            {/* Broker Profile Modal */}
            <BrokerProfileModal
                isOpen={!!selectedBroker}
                onClose={() => setSelectedBroker(null)}
                ticker={selectedTicker}
                brokerCode={selectedBroker || ''}
                startDate={startDate}
                endDate={endDate}
            />

            {/* Paste Modal */}
            {showPasteModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-xl bg-slate-800 border-slate-600">
                        <CardHeader className="py-3">
                            <CardTitle className="flex items-center justify-between text-base">
                                <span>Paste Done Detail Data</span>
                                <Button variant="ghost" size="sm" onClick={() => setShowPasteModal(false)}><X className="w-4 h-4" /></Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Ticker</label>
                                    <Input value={pasteTickerInput} onChange={(e) => setPasteTickerInput(e.target.value.toUpperCase())}
                                        placeholder="ANTM" className="bg-slate-700 border-slate-600 uppercase" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Trade Date</label>
                                    <Input type="date" value={pasteDateInput} onChange={(e) => setPasteDateInput(e.target.value)}
                                        className="bg-slate-700 border-slate-600" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-slate-400">Trade Data (TSV from NeoBDM)</label>
                                    <Button variant="outline" size="sm" onClick={handlePasteFromClipboard} className="h-6 text-xs">
                                        <Clipboard className="w-3 h-3 mr-1" />Paste
                                    </Button>
                                </div>
                                <textarea value={pasteData} onChange={(e) => setPasteData(e.target.value)}
                                    placeholder="Paste TSV data from NeoBDM..."
                                    className="w-full h-36 bg-slate-700 border border-slate-600 rounded p-2 text-xs font-mono resize-none text-white" />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    {pasteData ? `${pasteData.split('\n').length} lines` : 'Expected format: Time, Stock, Brd, Price, Qty, BT, BC, SC, ST'}
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowPasteModal(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSave} disabled={saving || !pasteData || !pasteTickerInput || !pasteDateInput}
                                    className="bg-teal-600 hover:bg-teal-700">
                                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                    Save Data
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
