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
    ImposterAnalysis, TradeRecord, SpeedAnalysis, CombinedAnalysis, RangeAnalysis
} from '@/services/api/doneDetail';
import { BrokerProfileModal } from './BrokerProfileModal';
import { ImposterTreeMap } from './ImposterTreeMap';
import { SignalGauge } from './SignalGauge';
import { TugOfWarBar } from './TugOfWarBar';
import { MetricSparkline } from './MetricSparkline';
import { BrokerDivergingBars } from './BrokerDivergingBars';
import { SpeedDynamicsChart } from './SpeedDynamicsChart';
import { SpeedTreemap } from './SpeedTreemap';
import { RetailCapitulationMonitor } from './RetailCapitulationMonitor';
import { ImposterRecurrenceHeatmap } from './ImposterRecurrenceHeatmap';
import { GhostBrokerRanking } from './GhostBrokerRanking';
import { BattleTimelineChart } from './BattleTimelineChart';
import { RangeSummaryCards } from './RangeSummaryCards';

interface DoneDetailSectionProps {
    ticker: string;
    onTickerChange?: (ticker: string) => void;
}

// Format value in Rupiah
const formatRupiah = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return 'Rp 0';
    if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `Rp ${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `Rp ${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `Rp ${(value / 1e3).toFixed(0)}K`;
    return `Rp ${value.toFixed(0)}`;
};

const formatLot = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
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
    const [rangeData, setRangeData] = useState<RangeAnalysis | null>(null);

    // Filter and sort state
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<ColumnFilters>({ time: '', seller: '', buyer: '', lot: '', price: '', value: '' });
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<'overview' | 'imposter' | 'speed' | 'range'>('overview');
    const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
    const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]); // For Imposter/Top stats
    const [selectedSpeedBrokers, setSelectedSpeedBrokers] = useState<string[]>([]); // For Speed Heartbeat

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

            // Check if response contains an error (no synthesis available)
            if ((combined as any).error === 'no_synthesis') {
                console.warn('No synthesis data available:', (combined as any).message);
                // Set empty/default data instead of crashing
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
                // Fallback if backend doesn't return it (shouldn't happen with new backend)
                const imposter = await doneDetailApi.getImposterAnalysis(selectedTicker, startDate, endDate);
                // Also check for error in imposter response
                if (!(imposter as any).error) {
                    setAnalysisData(imposter);
                }
            }

            if (combined.speed_analysis) {
                setSpeedData(combined.speed_analysis);
            } else {
                // Fallback
                const speed = await doneDetailApi.getSpeedAnalysis(selectedTicker, startDate, endDate);
                // Also check for error in speed response
                if (!(speed as any).error) {
                    setSpeedData(speed);
                }
            }

            // Fetch Range Analysis when in range mode (or always for multi-day insights)
            if (dateMode === 'range' && startDate !== endDate) {
                const range = await doneDetailApi.getRangeAnalysis(selectedTicker, startDate, endDate);
                setRangeData(range);
            } else {
                setRangeData(null);
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

    // Data for TreeMap (Calculate Net Value from trades)
    const treeMapData = useMemo(() => {
        if (!analysisData) return [];

        // 1. Calculate Net Value for each broker from individual imposter trades
        const brokerNetCalcs = new Map<string, number>();

        analysisData.imposter_trades.forEach(t => {
            const current = brokerNetCalcs.get(t.broker_code) || 0;
            if (t.direction === 'BUY') {
                brokerNetCalcs.set(t.broker_code, current + t.value);
            } else {
                brokerNetCalcs.set(t.broker_code, current - t.value);
            }
        });

        // 2. Merge with broker stats
        return analysisData.by_broker.map(b => ({
            broker: b.broker,
            total_value: b.total_value,
            net_value: brokerNetCalcs.get(b.broker) || 0,
            strong_count: b.strong_count,
            possible_count: b.possible_count
        }));
    }, [analysisData]);

    const divergingBarData = useMemo(() => {
        if (!analysisData) return [];

        const brokerStats = new Map<string, { buy: number, sell: number }>();

        analysisData.imposter_trades.forEach(t => {
            const current = brokerStats.get(t.broker_code) || { buy: 0, sell: 0 };
            if (t.direction === 'BUY') {
                current.buy += t.value;
            } else {
                current.sell += t.value;
            }
            brokerStats.set(t.broker_code, current);
        });

        return analysisData.by_broker.map(b => {
            const stats = brokerStats.get(b.broker) || { buy: 0, sell: 0 };
            return {
                broker: b.broker,
                name: b.name,
                total_value: b.total_value,
                buy_value: stats.buy,
                sell_value: stats.sell,
                net_value: stats.buy - stats.sell
            };
        });
    }, [analysisData]);

    // Data for Imposter Sparkline
    const imposterSparklineData = useMemo(() => {
        if (!analysisData?.imposter_trades) return [];

        // Group by HH:MM
        const grouped = new Map<string, number>();
        analysisData.imposter_trades.forEach(t => {
            // Simplify time to HH:MM to reduce points if needed, or keep HH:MM:SS
            // Assuming simplified for sparkline smoothness
            const timeKey = t.trade_time.substring(0, 5); // 09:00
            grouped.set(timeKey, (grouped.get(timeKey) || 0) + 1);
        });

        // Convert key-value to array and sort
        const sorted = Array.from(grouped.entries())
            .map(([time, count]) => ({ time, count }))
            .sort((a, b) => a.time.localeCompare(b.time));

        return sorted;
        return sorted;
    }, [analysisData]);

    // Data for Speed Treemap Heatmap (Size=Freq, Color=TPS)
    const speedTreemapData = useMemo(() => {
        if (!speedData?.speed_by_broker) return [];

        return speedData.speed_by_broker
            .filter(b => b.total_trades > 0)
            .map(b => ({
                name: b.broker,
                broker_name: b.name,
                size: b.total_trades, // Area = Frequency Dominance
                tps: b.trades_per_second, // Color = Heat/Intensity
                value: b.total_value
            }))
            .sort((a, b) => b.size - a.size); // Sort by size for better layout
    }, [speedData]);

    // Derived Timeline for Speed Dynamics (Heartbeat) - Filterable
    const displayedSpeedTimeline = useMemo(() => {
        if (!speedData?.timeline) return [];

        // If no filter selected, show total market heartbeat
        if (selectedSpeedBrokers.length === 0) {
            return speedData.timeline;
        }

        // If filtered, aggregate selected brokers' timelines
        const combinedTimelineMap = new Map<string, number>(); // time -> trades

        selectedSpeedBrokers.forEach(broker => {
            const brokerTimeline = speedData.broker_timelines?.[broker];
            if (brokerTimeline) {
                brokerTimeline.forEach((point: any) => {
                    const current = combinedTimelineMap.get(point.time) || 0;
                    combinedTimelineMap.set(point.time, current + point.trades);
                });
            }
        });

        // Convert map back to array and sort by time
        return Array.from(combinedTimelineMap.entries())
            .map(([time, trades]) => ({ time, trades }))
            .sort((a, b) => a.time.localeCompare(b.time));

    }, [speedData, selectedSpeedBrokers]);

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

    // Detect actual range mode (range selection with different dates)
    const isRangeMode = dateMode === 'range' && startDate !== endDate && rangeData !== null;

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
                    {/* Summary Cards - Single Date Only */}
                    {!isRangeMode && (
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
                    )}

                    {/* Imposter Summary by Broker - Single Date Only */}
                    {!isRangeMode && analysisData.by_broker.length > 0 && (
                        <div className="mb-4">
                            <div className="text-xs text-slate-500 mb-2">Imposter Brokers Distribution:</div>
                            <ImposterTreeMap data={treeMapData} />
                        </div>
                    )}

                    {/* Tabs - Only show for single-date mode */}
                    {!isRangeMode && (
                        <div className="flex items-center gap-1 border-b border-slate-700 pb-1">
                            {[
                                { id: 'overview', label: '📊 Overview', active: true },
                                { id: 'imposter', label: '🎭 Imposter', active: true },
                                { id: 'speed', label: '⚡ Speed', active: true },
                            ].map((tab) => (
                                <button key={tab.id}
                                    className={`px-3 py-1.5 text-xs rounded-t ${activeTab === tab.id
                                        ? 'bg-slate-800 text-teal-400 border border-b-0 border-slate-600'
                                        : 'text-slate-500 hover:text-slate-300'}`}
                                    onClick={() => setActiveTab(tab.id as any)}
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
                    )}

                    {/* Range Mode Header */}
                    {isRangeMode && (
                        <div className="flex items-center justify-between border-b border-purple-500/30 pb-2 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="text-lg font-bold text-purple-400">📈 Range Analysis</div>
                                <span className="text-xs text-slate-500">
                                    {rangeData?.summary?.total_days ?? 0} days: {startDate} → {endDate}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
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
                    )}

                    {/* Overview Dashboard - Single Date Only */}
                    {!isRangeMode && activeTab === 'overview' && combinedData && (
                        <div className="space-y-4">
                            {/* Signal Strength Hero */}
                            <Card className={`border-2 overflow-hidden relative ${combinedData.signal.direction === 'BULLISH'
                                ? 'bg-gradient-to-br from-slate-900 to-green-950/30 border-green-500/30'
                                : combinedData.signal.direction === 'BEARISH'
                                    ? 'bg-gradient-to-br from-slate-900 to-red-950/30 border-red-500/30'
                                    : 'bg-slate-900/50 border-slate-600'
                                }`}>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
                                <CardContent className="py-2 px-4 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Market Signal</div>
                                        <div className="text-3xl font-black text-white leading-tight">
                                            {combinedData.signal.direction}
                                        </div>
                                        <div className="text-sm text-slate-400">
                                            {combinedData.signal.description}
                                        </div>
                                    </div>
                                    <div className="w-[180px]">
                                        <SignalGauge
                                            value={combinedData.signal.confidence}
                                            direction={combinedData.signal.direction}
                                            label={combinedData.signal.level}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Key Metrics Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {/* Imposter Card */}
                                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-shadow overflow-hidden relative">
                                    <CardContent className="py-3 px-4 text-center z-10 relative">
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                            <span className="text-xl font-black text-red-500">{combinedData.key_metrics.strong_impostor_count}</span>
                                            <span className="text-slate-600 text-lg">/</span>
                                            <span className="text-xl font-black text-orange-400">{combinedData.key_metrics.possible_impostor_count}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 font-medium">Strong / Possible Impostor</div>
                                    </CardContent>
                                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
                                        <MetricSparkline data={imposterSparklineData} dataKey="count" color="#ef4444" height={40} />
                                    </div>
                                </Card>

                                {/* TPS Card */}
                                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(20,184,166,0.1)] hover:shadow-[0_0_20px_rgba(20,184,166,0.2)] transition-shadow overflow-hidden relative">
                                    <CardContent className="py-3 px-4 text-center z-10 relative">
                                        <div className="text-2xl font-black text-teal-400 mb-1">{combinedData.key_metrics.avg_tps}</div>
                                        <div className="text-xs text-slate-400 font-medium">Avg Trades/Sec</div>
                                    </CardContent>
                                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
                                        <MetricSparkline data={combinedData.timeline} dataKey="trades" color="#14b8a6" height={40} />
                                    </div>
                                </Card>

                                {/* Burst Card */}
                                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(234,179,8,0.1)] hover:shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-shadow overflow-hidden relative">
                                    <CardContent className="py-3 px-4 text-center z-10 relative">
                                        <div className="text-2xl font-black text-yellow-400 mb-1">{combinedData.key_metrics.burst_count}</div>
                                        <div className="text-xs text-slate-400 font-medium">Burst Events</div>
                                    </CardContent>
                                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
                                        {/* Use same timeline but maybe different color or filtered only for bursts? Keeping simple for visual consistency */}
                                        <MetricSparkline data={combinedData.timeline} dataKey="trades" color="#eab308" height={40} />
                                    </div>
                                </Card>

                                {/* Total Trades Card */}
                                <Card className="bg-slate-900/50 border-slate-700 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-shadow overflow-hidden relative">
                                    <CardContent className="py-3 px-4 text-center z-10 relative">
                                        <div className="text-2xl font-black text-white mb-1">{combinedData.key_metrics.total_trades.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400 font-medium">Total Trades</div>
                                    </CardContent>
                                    <div className="absolute bottom-0 left-0 right-0 h-10 opacity-20">
                                        <MetricSparkline data={combinedData.timeline} dataKey="trades" color="#ffffff" height={40} />
                                    </div>
                                </Card>
                            </div>

                            {/* Impostor Flow */}
                            <Card className="bg-slate-900/50 border-slate-700">
                                <CardHeader className="py-2 px-4 border-b border-slate-800/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm text-white flex items-center gap-2">
                                            💰 Smart Money Flow
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="py-4 px-6">
                                    <TugOfWarBar
                                        buyPct={combinedData.impostor_flow.buy_pct}
                                        sellPct={combinedData.impostor_flow.sell_pct}
                                        netValue={combinedData.impostor_flow.net_value}
                                        buyValue={combinedData.impostor_flow.buy_value}
                                        sellValue={combinedData.impostor_flow.sell_value}
                                    />
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

                    {/* Imposter Trades Table - Single Date Only */}
                    {!isRangeMode && activeTab === 'imposter' && (
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

                            {/* Broker Heatmap Cards -> Replaced by Diverging Bars */}
                            {divergingBarData.length > 0 && (
                                <Card className="bg-slate-900/50 border-slate-700">
                                    <CardHeader className="py-2 px-4">
                                        <CardTitle className="text-sm text-purple-400">🏆 Top Impostor Brokers (Net Flow)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2 px-4">
                                        <BrokerDivergingBars
                                            data={divergingBarData}
                                            onBrokerClick={setSelectedBroker}
                                            height={500}
                                        />
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



                    {/* Speed Tab Content - Single Date Only */}
                    {!isRangeMode && activeTab === 'speed' && speedData && (
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

                                {/* Speed Dynamics Chart (Heartbeat) */}
                                {speedData.timeline.length > 0 && (
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm text-orange-400 font-bold">⚡ Speed Dynamics (Market Heartbeat)</div>
                                                <div className="text-xs text-slate-500">(Trades Per Second)</div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-700 rounded-sm"></div> Normal</div>
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-sm"></div> High</div>
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> Burst</div>
                                            </div>
                                        </div>

                                        {/* Broker Filter Chips for Speed Chart */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <button
                                                onClick={() => setSelectedSpeedBrokers([])}
                                                className={`px-2 py-1 rounded text-xs font-bold transition-colors border ${selectedSpeedBrokers.length === 0
                                                    ? 'bg-orange-500 text-white border-orange-500'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50'
                                                    }`}
                                            >
                                                ALL MARKET
                                            </button>
                                            {speedData.speed_by_broker.slice(0, 10).map(b => (
                                                <button
                                                    key={b.broker}
                                                    onClick={() => {
                                                        setSelectedSpeedBrokers(prev =>
                                                            prev.includes(b.broker)
                                                                ? prev.filter(x => x !== b.broker)
                                                                : [...prev, b.broker]
                                                        );
                                                    }}
                                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors border flex items-center gap-1 ${selectedSpeedBrokers.includes(b.broker)
                                                        ? 'bg-orange-500/20 text-orange-400 border-orange-500'
                                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-orange-500/50'
                                                        }`}
                                                >
                                                    {b.broker}
                                                    {selectedSpeedBrokers.includes(b.broker) && <span className="text-[10px]">✕</span>}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 shadow-inner min-h-[250px] relative">
                                            {selectedSpeedBrokers.length > 0 && !speedData.broker_timelines && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10 text-center p-4">
                                                    <p className="text-orange-400 font-bold mb-2">⚠️ Detailed Data Missing</p>
                                                    <p className="text-slate-400 text-sm">To filter by specific brokers, the backend must be updated to return "broker_timelines".</p>
                                                    <p className="text-slate-500 text-xs mt-2">Try restarting the backend server.</p>
                                                </div>
                                            )}

                                            {displayedSpeedTimeline.length === 0 && selectedSpeedBrokers.length > 0 && speedData.broker_timelines ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                                                    <p className="text-slate-500 font-bold">No activity found for selected broker(s)</p>
                                                </div>
                                            ) : (
                                                <SpeedDynamicsChart
                                                    data={displayedSpeedTimeline}
                                                    avgTps={selectedSpeedBrokers.length > 0 ? undefined : speedData.summary.avg_trades_per_second}
                                                    height={250}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Broker Speed Ranking -> Replaced by Treemap Heatmap */}
                                <div className="text-sm text-purple-400 mb-3 font-bold">🏆 Top Speed Brokers Dominance (Treemap Heatmap)</div>
                                {speedTreemapData.length > 0 ? (
                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                        <div className="text-xs text-slate-500 mb-2 italic">
                                            Size: Trade Frequency (Noise) • Color: <span className="text-red-500 font-bold">Heat/Speed (TPS)</span>
                                        </div>
                                        <SpeedTreemap
                                            data={speedTreemapData}
                                            onBrokerClick={setSelectedBroker}
                                            height={500}
                                        />
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

                    {/* Range Analysis - Range Mode Only (5 Sections) */}
                    {isRangeMode && rangeData && (
                        <div className="space-y-6">
                            {/* Validate that we have all required data before rendering */}
                            {!rangeData.summary || !rangeData.retail_capitulation || !rangeData.imposter_recurrence || !rangeData.battle_timeline ? (
                                <div className="text-center py-8">
                                    <div className="text-red-400 text-sm mb-2">⚠️ Incomplete Range Analysis Data</div>
                                    <div className="text-slate-500 text-xs">
                                        {rangeData.error || 'Some required data is missing. Please try refreshing or selecting a different date range.'}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Section 1: Summary Cards */}
                                    <RangeSummaryCards summary={rangeData.summary} />

                                    {/* Section 2: Retail Capitulation (50% Rule) */}
                                    <div>
                                        <div className="text-sm text-orange-400 mb-3 font-bold flex items-center gap-2">
                                            📊 Section 1: Retail Capitulation Monitor
                                            <span className="text-xs text-slate-500 font-normal">(50% Rule)</span>
                                        </div>
                                        <RetailCapitulationMonitor
                                            brokers={rangeData.retail_capitulation.brokers}
                                            overallPct={rangeData.retail_capitulation.overall_pct}
                                            safeCount={rangeData.retail_capitulation.safe_count}
                                            holdingCount={rangeData.retail_capitulation.holding_count}
                                        />
                                    </div>

                                    {/* Section 3: Imposter Recurrence Analysis */}
                                    <div>
                                        <div className="text-sm text-purple-400 mb-3 font-bold flex items-center gap-2">
                                            🔍 Section 2: Imposter Recurrence Analysis
                                            <span className="text-xs text-slate-500 font-normal">(Ghost Broker Detection)</span>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {/* Heatmap */}
                                            <ImposterRecurrenceHeatmap
                                                brokers={rangeData.imposter_recurrence.brokers}
                                                allDates={rangeData.battle_timeline.map(d => d.date)}
                                            />

                                            {/* Ghost Broker Ranking */}
                                            <GhostBrokerRanking
                                                brokers={rangeData.imposter_recurrence.brokers}
                                                onBrokerClick={setSelectedBroker}
                                            />
                                        </div>
                                    </div>

                                    {/* Section 4: Battle Timeline */}
                                    <div>
                                        <div className="text-sm text-blue-400 mb-3 font-bold flex items-center gap-2">
                                            ⚔️ Section 3: Battle Timeline
                                            <span className="text-xs text-slate-500 font-normal">(Daily Smart Money Activity)</span>
                                        </div>
                                        <BattleTimelineChart
                                            data={rangeData.battle_timeline}
                                            height={300}
                                        />
                                    </div>

                                    {/* Section 5: Detailed Imposter Trade List */}
                                    {analysisData && analysisData.imposter_trades.length > 0 && (
                                        <Card className="bg-slate-900/50 border-slate-700">
                                            <CardHeader className="py-2 px-4 border-b border-slate-700">
                                                <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                                                    📋 Section 4: Detailed Imposter Trades
                                                    <span className="text-xs text-slate-500 font-normal">
                                                        ({analysisData.imposter_trades.length} trades)
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="py-2 px-0">
                                                <div className="max-h-[400px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="sticky top-0 bg-slate-900 z-10">
                                                            <tr className="border-b border-slate-700">
                                                                <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                                                                <th className="text-left py-2 px-2 text-slate-400 font-medium">Time</th>
                                                                <th className="text-left py-2 px-2 text-slate-400 font-medium">Broker</th>
                                                                <th className="text-right py-2 px-2 text-slate-400 font-medium">Lot</th>
                                                                <th className="text-right py-2 px-2 text-slate-400 font-medium">Value</th>
                                                                <th className="text-center py-2 px-2 text-slate-400 font-medium">Dir</th>
                                                                <th className="text-left py-2 px-2 text-slate-400 font-medium">Counter</th>
                                                                <th className="text-center py-2 px-2 text-slate-400 font-medium">Level</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {analysisData.imposter_trades.slice(0, 100).map((trade, i) => (
                                                                <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                                    <td className="py-2 px-3 text-slate-500 font-mono">{trade.trade_date?.slice(-5) || '-'}</td>
                                                                    <td className="py-2 px-2 text-slate-400 font-mono">{trade.trade_time}</td>
                                                                    <td className="py-2 px-2">
                                                                        <span className={`font-bold ${trade.direction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {trade.broker_code}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-2 text-right text-white font-mono">{trade.qty.toLocaleString()}</td>
                                                                    <td className="py-2 px-2 text-right text-teal-400 font-mono">{formatRupiah(trade.value)}</td>
                                                                    <td className="py-2 px-2 text-center">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.direction === 'BUY'
                                                                            ? 'bg-green-500/20 text-green-400'
                                                                            : 'bg-red-500/20 text-red-400'
                                                                            }`}>
                                                                            {trade.direction}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-2 text-slate-400">{trade.counterparty}</td>
                                                                    <td className="py-2 px-2 text-center">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.level === 'STRONG'
                                                                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                                                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                                                            }`}>
                                                                            {trade.level}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {analysisData.imposter_trades.length > 100 && (
                                                        <div className="text-center py-2 text-xs text-slate-500">
                                                            Showing first 100 of {analysisData.imposter_trades.length} trades
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </>
                            )}
                        </div>
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
