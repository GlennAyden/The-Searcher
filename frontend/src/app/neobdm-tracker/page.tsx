'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import {
    Search,
    TrendingUp,
    TrendingDown,
    Activity,
    Calendar,
    ArrowLeft,
    Filter,
    Info as InfoIcon,
    AlertCircle,
    History as HistoryIcon
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Cell,
    ReferenceDot,
    Area
} from 'recharts';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function NeoBDMTrackerPage() {
    const [symbol, setSymbol] = useState('BBCA');
    const [method] = useState('m'); // Locked to Market Maker for simplicity
    const [period] = useState('c'); // Locked to Cumulative for background data, but UI focuses on daily flow
    const [limit, setLimit] = useState(30);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [availableTickers, setAvailableTickers] = useState<string[]>([]);
    const [flowMetric, setFlowMetric] = useState<string>('flow_d0');
    const [searchInput, setSearchInput] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const [hotSignals, setHotSignals] = useState<any[]>([]);
    const [priceFilter, setPriceFilter] = useState<string>('');
    const [showLegend, setShowLegend] = useState(false);

    // Filter tickers based on input
    const filteredTickers = useMemo(() => {
        const query = searchInput.toUpperCase();
        if (!query) return availableTickers;
        // Search by ticker name
        return availableTickers.filter(t => t.toUpperCase().includes(query));
    }, [availableTickers, searchInput]);

    // Filter hot signals based on price
    const filteredHotSignals = useMemo(() => {
        if (!priceFilter.trim()) return hotSignals;

        const filterExpr = priceFilter.trim();

        // Check for comparison operators
        const match = filterExpr.match(/^(>=|<=|>|<|=)(.+)$/);

        if (match) {
            const operator = match[1];
            const targetPrice = parseFloat(match[2].replace(/,/g, ''));

            if (isNaN(targetPrice)) return hotSignals;

            return hotSignals.filter(sig => {
                const price = parseFloat(String(sig.price || '0').replace(/,/g, ''));

                switch (operator) {
                    case '>': return price > targetPrice;
                    case '<': return price < targetPrice;
                    case '>=': return price >= targetPrice;
                    case '<=': return price <= targetPrice;
                    case '=': return price === targetPrice;
                    default: return true;
                }
            });
        }

        // Fallback: substring match on symbol
        return hotSignals.filter(sig =>
            sig.symbol.toLowerCase().includes(filterExpr.toLowerCase())
        );
    }, [hotSignals, priceFilter]);

    // Load available tickers and Hot Signals
    useEffect(() => {
        const init = async () => {
            try {
                // 1. Get List
                const result = await api.getNeoBDMTickers();
                setAvailableTickers(result.tickers);

                // 2. Get Hot Signals (Smart Landing)
                const hotResult = await api.getNeoBDMHotList();
                setHotSignals(hotResult.signals || []);

                // 3. Intelligent Default
                // If url param exists (todo: add router logic later), use it.
                // Otherwise, pick the top hot signal, or fallback to first available.
                const urlParams = new URLSearchParams(window.location.search);
                const tickerParam = urlParams.get('ticker');

                if (tickerParam) {
                    setSymbol(tickerParam);
                } else if (hotResult.signals && hotResult.signals.length > 0) {
                    setSymbol(hotResult.signals[0].symbol);
                } else if (result.tickers.length > 0) {
                    // Fallback to first available if no BBCA or hot signals
                    if (!result.tickers.includes('BBCA') && !result.tickers.some(t => t.includes('BBCA'))) {
                        setSymbol(result.tickers[0]);
                    }
                    // If BBCA exists, it stays as default state 'BBCA' unless overridden above
                }
            } catch (err) {
                console.error("Failed to fetch NeoBDM tickers/hot list", err);
            }
        };
        init();
    }, []);

    // Handle clicks outside dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync searchInput with symbol on initial load or symbol change
    useEffect(() => {
        setSearchInput(symbol);
    }, [symbol]);

    const loadData = async () => {
        if (!symbol) return;
        setLoading(true);
        setError(null);
        try {
            const result = await api.getNeoBDMHistory(symbol, method, period, limit);
            setData(result.history);

            if (result.history.length === 0) {
                setError(`No historical data found for ${symbol}`);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load flow history");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [symbol, method, period, limit, flowMetric]);

    // Prepare data for Chart
    const chartData = useMemo(() => {
        return data.map(item => ({
            ...item,
            activeFlow: item[flowMetric] || item.flow, // Use selected metric
            date: new Date(item.scraped_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
            fullDate: item.scraped_at,
            // Add a synthetic field for markers
            isCrossing: item.crossing && item.crossing.toLowerCase() !== 'x' && item.crossing.toLowerCase() !== 'null',
            isUnusual: item.unusual && item.unusual.toLowerCase() !== 'x' && item.unusual.toLowerCase() !== 'null',
            isPinky: item.pinky && item.pinky.toLowerCase() !== 'x' && item.pinky.toLowerCase() !== 'null',
            // Store raw values for tooltip display
            crossingVal: item.crossing,
            unusualVal: item.unusual,
            pinkyVal: item.pinky
        }));
    }, [data, flowMetric]);

    const getMetricLabel = (m: string) => {
        const labels: Record<string, string> = {
            'flow_d0': 'Money Flow (D-0)',
            'flow_w1': 'Money Flow (W-1)',
            'flow_c3': 'Money Flow (3D)',
            'flow_c5': 'Money Flow (5D)',
            'flow_c10': 'Money Flow (10D)',
            'flow_c20': 'Money Flow (20D)',
            'flow': 'Money Flow'
        };
        return labels[m] || 'Money Flow';
    };

    const parseMarkerValue = (val: any) => {
        if (!val || typeof val !== 'string') return null;
        if (val.includes('|')) return val.split('|')[1]; // Value extracted from title
        if (val.toLowerCase() === 'v') return null; // Just a marker
        return val; // Maybe direct value
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;

            const crossingMeta = parseMarkerValue(item.crossingVal);
            const unusualMeta = parseMarkerValue(item.unusualVal);
            const pinkyMeta = parseMarkerValue(item.pinkyVal);

            return (
                <div className="bg-[#181a1f] border border-zinc-700 p-3 rounded-md shadow-xl font-mono text-[10px] min-w-[200px] z-50">
                    <p className="text-zinc-400 mb-1 border-b border-zinc-800 pb-1">{item.fullDate}</p>
                    <div className="space-y-1 mt-2">
                        <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">Price:</span>
                            <span className="text-blue-400 font-bold">{item.price?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">{getMetricLabel(flowMetric)}:</span>
                            <span className={cn("font-bold", item.activeFlow >= 0 ? "text-emerald-400" : "text-red-400")}>
                                {item.activeFlow?.toLocaleString()} <span className="text-[8px] text-zinc-500">B</span>
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-zinc-500">Chg%:</span>
                            <span className={cn("font-bold", item.pct_change >= 0 ? "text-emerald-400" : "text-red-400")}>
                                {item.pct_change?.toFixed(2)}%
                            </span>
                        </div>
                        {(item.isCrossing || item.isUnusual || item.isPinky) && (
                            <div className="mt-2 pt-2 border-t border-zinc-800 flex flex-col gap-1">
                                {item.isCrossing && (
                                    <div className="flex justify-between items-center bg-pink-500/10 p-1 rounded-sm">
                                        <span className="bg-pink-500/20 text-pink-400 px-1 rounded-sm text-[8px] font-bold">CROSSING</span>
                                        {crossingMeta && <span className="text-pink-300 font-bold">{crossingMeta}</span>}
                                    </div>
                                )}
                                {item.isUnusual && (
                                    <div className="flex justify-between items-center bg-orange-500/10 p-1 rounded-sm">
                                        <span className="bg-orange-500/20 text-orange-400 px-1 rounded-sm text-[8px] font-bold">UNUSUAL</span>
                                        {unusualMeta && <span className="text-orange-300 font-bold">{unusualMeta}</span>}
                                    </div>
                                )}
                                {item.isPinky && (
                                    <div className="flex justify-between items-center bg-red-500/10 p-1 rounded-sm border border-red-500/20">
                                        <div className="flex items-center gap-1">
                                            <span className="bg-red-500/20 text-red-500 px-1 rounded-sm text-[8px] font-bold underline decoration-red-500/50">REPO RISK</span>
                                            <span className="text-[8px] text-red-400 font-bold animate-pulse">!</span>
                                        </div>
                                        {pinkyMeta && <span className="text-red-300 font-bold">{pinkyMeta}</span>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-0 min-h-screen bg-[#0f1115] text-zinc-100 font-mono">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between bg-[#181a1f] p-2 border-b border-zinc-800/60 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
                <div className="flex items-center gap-4">
                    <Link href="/neobdm-summary" className="hover:bg-zinc-800 p-1 rounded-sm transition-colors group">
                        <ArrowLeft className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        <h1 className="text-[14px] font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                            NeoBDM Flow Tracker
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative" ref={dropdownRef}>
                        <div className="flex items-center gap-2 bg-[#23252b] px-2 py-1 rounded-sm border border-zinc-700/50 focus-within:border-blue-500/50 transition-all">
                            <Search className="w-3.5 h-3.5 text-zinc-500" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => {
                                    setSearchInput(e.target.value.toUpperCase());
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                placeholder="CARI EMITEN..."
                                className="bg-transparent text-zinc-200 text-[10px] outline-none font-bold uppercase w-32 placeholder:text-zinc-600"
                            />
                        </div>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && filteredTickers.length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-[#181a1f] border border-zinc-700 rounded-sm shadow-2xl max-h-60 overflow-y-auto z-[60] scrollbar-thin scrollbar-thumb-zinc-700">
                                {filteredTickers.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setSymbol(t);
                                            setSearchInput(t);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-[10px] font-bold transition-colors hover:bg-blue-500/10 hover:text-blue-400",
                                            symbol === t ? "bg-blue-500/20 text-blue-400" : "text-zinc-400"
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-6 w-px bg-zinc-800 mx-1" />

                    <div className="flex items-center gap-2">
                        {/* Metric Detail Selector */}
                        <div className="flex items-center gap-1.5 bg-[#23252b] px-2 py-1 rounded-sm border border-zinc-700/50">
                            <span className="text-[8px] text-zinc-500 font-bold uppercase">Metric:</span>
                            <select
                                value={flowMetric}
                                onChange={(e) => setFlowMetric(e.target.value)}
                                className="bg-transparent text-blue-400 font-bold text-[10px] outline-none cursor-pointer"
                            >
                                <option value="flow_d0">D-0 (Daily)</option>
                                <option value="flow_w1">W-1 (Weekly)</option>
                                <option value="flow_c3">C-3 (3 Days)</option>
                                <option value="flow_c5">C-5 (5 Days)</option>
                                <option value="flow_c10">C-10 (10 Days)</option>
                                <option value="flow_c20">C-20 (20 Days)</option>
                            </select>
                        </div>

                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            className="bg-[#23252b] border border-zinc-700/50 text-zinc-200 text-[10px] rounded-sm py-1 px-2 outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value={15}>15D</option>
                            <option value={30}>30D</option>
                            <option value={60}>60D</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Hot Signals Section - Grid Layout */}
            {hotSignals.length > 0 && (
                <div className="bg-gradient-to-br from-[#0a0a0c] via-[#0f0f11] to-[#0a0a0c] border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="animate-pulse">🔥</span>
                                HOT SIGNALS
                            </span>
                            <span className="text-[9px] text-amber-500/80 uppercase tracking-tight px-2 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/20">
                                Safe Mode: Liquid Only
                            </span>
                            <span className="text-[8px] text-zinc-600">
                                {filteredHotSignals.length} signal{filteredHotSignals.length > 1 ? 's' : ''} detected
                            </span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                            {/* Price Filter */}
                            <div className="flex items-center gap-1.5">
                                <label className="text-[9px] text-zinc-500 uppercase tracking-wide">Price:</label>
                                <input
                                    type="text"
                                    placeholder="e.g. <3000"
                                    value={priceFilter}
                                    onChange={(e) => setPriceFilter(e.target.value)}
                                    className="w-24 bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-[10px] rounded px-2 py-1 outline-none focus:border-blue-500"
                                    title="Use operators: >, <, >=, <=, ="
                                />
                                {priceFilter && (
                                    <button
                                        onClick={() => setPriceFilter('')}
                                        className="text-zinc-500 hover:text-zinc-300 text-[10px]"
                                        title="Clear filter"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Legend Toggle */}
                            <button
                                onClick={() => setShowLegend(!showLegend)}
                                className="text-[9px] px-2 py-1 rounded border border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all uppercase tracking-wide"
                                title="Show/hide legend"
                            >
                                {showLegend ? '📖 Hide' : '📖 Legend'}
                            </button>
                        </div>
                    </div>

                    {/* Legend Panel */}
                    {showLegend && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px]">
                                {/* Signal Strength */}
                                <div>
                                    <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Signal Strength:</span>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px]">🔥</span>
                                            <span className="text-emerald-400">VERY STRONG</span>
                                            <span className="text-zinc-600">(Score ≥150)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px]">⚡</span>
                                            <span className="text-blue-400">STRONG</span>
                                            <span className="text-zinc-600">(Score 90-149)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px]">⚠️</span>
                                            <span className="text-yellow-400">MODERATE</span>
                                            <span className="text-zinc-600">(Score 45-89)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px]">⏸️</span>
                                            <span className="text-zinc-500">WEAK</span>
                                            <span className="text-zinc-600">(Score 0-44)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Markers */}
                                <div>
                                    <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Markers:</span>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                            <span className="text-zinc-400">CROSSING</span>
                                            <span className="text-zinc-600">- Distribution pressure</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                            <span className="text-zinc-400">UNUSUAL</span>
                                            <span className="text-zinc-600">- Abnormal volume activity</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Timeframe Alignment */}
                                <div>
                                    <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Timeframe Alignment:</span>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-1 rounded-sm bg-emerald-500/20 text-emerald-400">✓✓✓</span>
                                            <span className="text-zinc-400">PERFECT</span>
                                            <span className="text-zinc-600">- D+W+C aligned (+30pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-1 rounded-sm bg-yellow-500/20 text-yellow-400">✓✓</span>
                                            <span className="text-zinc-400">PARTIAL</span>
                                            <span className="text-zinc-600">- 2 of 3 aligned (+15pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] px-1 rounded-sm bg-zinc-700/50 text-zinc-500">✓</span>
                                            <span className="text-zinc-400">WEAK</span>
                                            <span className="text-zinc-600">- Only 1 aligned (0pts)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Momentum Status */}
                                <div>
                                    <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Momentum:</span>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">🚀</span>
                                            <span className="text-zinc-400">ACCELERATING</span>
                                            <span className="text-zinc-600">- Increasing velocity (+30pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">↗️</span>
                                            <span className="text-zinc-400">INCREASING</span>
                                            <span className="text-zinc-600">- Positive trend (+20pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">➡️</span>
                                            <span className="text-zinc-400">STABLE</span>
                                            <span className="text-zinc-600">- Steady (+10pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">↘️</span>
                                            <span className="text-zinc-400">WEAKENING</span>
                                            <span className="text-zinc-600">- Declining (-10pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">🔻</span>
                                            <span className="text-zinc-400">DECLINING</span>
                                            <span className="text-zinc-600">- Rapid drop (-20pts)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Warning Levels */}
                                <div>
                                    <span className="text-zinc-500 font-bold uppercase text-[9px] mb-1 block">Risk Warnings:</span>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">🟢</span>
                                            <span className="text-zinc-400">NO_WARNINGS</span>
                                            <span className="text-zinc-600">- All clear (0pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">🟡</span>
                                            <span className="text-zinc-400">CAUTION</span>
                                            <span className="text-zinc-600">- Momentum slowing (-5pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">🟠</span>
                                            <span className="text-zinc-400">WARNING</span>
                                            <span className="text-zinc-600">- Weekly divergence (-15pts)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px]">🔴</span>
                                            <span className="text-zinc-400">HIGH_RISK</span>
                                            <span className="text-zinc-600">- Unsustained spike (-30pts)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="col-span-2 mt-1 pt-2 border-t border-zinc-800">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-400 font-mono">150B</span>
                                            <span className="text-zinc-600">= Money Flow (D-0)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-400 font-mono">+1.2%</span>
                                            <span className="text-zinc-600">= Price Change (1D)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-400 font-mono border border-emerald-500/30 px-1 rounded">95</span>
                                            <span className="text-zinc-600">= Signal Score</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Signals Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
                        {filteredHotSignals.map((sig, idx) => {
                            // Signal strength badge styling
                            const getStrengthStyle = (strength: string) => {
                                switch (strength) {
                                    case 'VERY_STRONG':
                                        return {
                                            bg: 'bg-gradient-to-r from-emerald-500/20 to-green-500/20',
                                            border: 'border-emerald-500/50',
                                            text: 'text-emerald-400',
                                            icon: '🔥',
                                            label: 'VERY STRONG',
                                            glow: 'shadow-emerald-500/20'
                                        };
                                    case 'STRONG':
                                        return {
                                            bg: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
                                            border: 'border-blue-500/50',
                                            text: 'text-blue-400',
                                            icon: '⚡',
                                            label: 'STRONG',
                                            glow: 'shadow-blue-500/20'
                                        };
                                    case 'MODERATE':
                                        return {
                                            bg: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20',
                                            border: 'border-yellow-500/50',
                                            text: 'text-yellow-400',
                                            icon: '⚠️',
                                            label: 'MODERATE',
                                            glow: 'shadow-yellow-500/20'
                                        };
                                    default:
                                        return {
                                            bg: 'bg-zinc-800/50',
                                            border: 'border-zinc-700',
                                            text: 'text-zinc-500',
                                            icon: '⏸️',
                                            label: 'WEAK',
                                            glow: 'shadow-none'
                                        };
                                }
                            };

                            const strength = getStrengthStyle(sig.signal_strength || 'WEAK');

                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSymbol(sig.symbol)}
                                    className={cn(
                                        "relative cursor-pointer rounded-xl border-2 transition-all duration-300 overflow-hidden group",
                                        "hover:shadow-2xl hover:scale-[1.02]",
                                        strength.bg,
                                        strength.border,
                                        sig.symbol === symbol ? "ring-2 ring-offset-2 ring-offset-[#0a0a0c] scale-[1.02]" : "",
                                        sig.symbol === symbol ? `ring-${strength.text.replace('text-', '')}` : ""
                                    )}
                                >
                                    {/* Card Header */}
                                    <div className={cn("px-4 py-3 border-b", strength.border)}>
                                        <div className="flex items-start justify-between">
                                            {/* Symbol & Strength */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[20px]">{strength.icon}</span>
                                                <div>
                                                    <div className={cn("text-[16px] font-bold tracking-tight", strength.text)}>
                                                        {(() => {
                                                            let cleanSymbol = String(sig.symbol || '');
                                                            // Clean watchlist text
                                                            cleanSymbol = cleanSymbol.replace(/\|?Add\s+\w+\s+to\s+Watchlist/gi, '').trim();
                                                            cleanSymbol = cleanSymbol.replace(/\|?Remove\s+from\s+Watchlist/gi, '').trim();
                                                            cleanSymbol = cleanSymbol.replace(/^\|+|\|+$/g, '').trim();
                                                            return cleanSymbol;
                                                        })()}
                                                    </div>
                                                    <div className="text-[9px] text-zinc-500 uppercase tracking-wide">
                                                        {strength.label}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Score Badge (Large) */}
                                            <div className={cn(
                                                "px-3 py-1.5 rounded-lg text-[14px] font-bold border-2",
                                                strength.bg,
                                                strength.border,
                                                strength.text
                                            )}>
                                                {sig.signal_score}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="px-4 py-3 space-y-3">
                                        {/* Price & Flow Stats */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <div className="text-[9px] text-zinc-500 uppercase mb-0.5">Price</div>
                                                <div className="text-[12px] font-mono font-semibold text-zinc-300">
                                                    {sig.price}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-zinc-500 uppercase mb-0.5">Flow</div>
                                                <div className={cn(
                                                    "text-[12px] font-mono font-bold",
                                                    parseFloat(sig.flow?.toString().replace(/,/g, '') || '0') >= 0 ? "text-emerald-400" : "text-red-400"
                                                )}>
                                                    {sig.flow}B
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] text-zinc-500 uppercase mb-0.5">Change</div>
                                                <div className={cn(
                                                    "text-[12px] font-mono font-bold",
                                                    parseFloat(sig.change?.toString() || '0') >= 0 ? "text-emerald-400" : "text-red-400"
                                                )}>
                                                    {sig.change > 0 ? '+' : ''}{sig.change}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* Indicators Row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Markers */}
                                            {sig.crossing && (
                                                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                    CROSSING
                                                </span>
                                            )}
                                            {sig.unusual && (
                                                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                    UNUSUAL
                                                </span>
                                            )}

                                            {/* Alignment */}
                                            {sig.alignment_label && (
                                                <span
                                                    className={cn(
                                                        "text-[9px] px-2 py-0.5 rounded-md font-semibold border",
                                                        sig.alignment_status === "PERFECT_ALIGNMENT" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                                                            sig.alignment_status === "PARTIAL_ALIGNMENT" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                                                                "bg-zinc-700/50 text-zinc-400 border-zinc-600"
                                                    )}
                                                    title={`Timeframe: ${sig.alignment_timeframes || 'None'}`}
                                                >
                                                    {sig.alignment_label}
                                                </span>
                                            )}

                                            {/* Momentum */}
                                            {sig.momentum_icon && (
                                                <span
                                                    className={cn(
                                                        "text-[11px] px-1.5 py-0.5",
                                                        sig.momentum_status === "ACCELERATING" ? "animate-pulse" : ""
                                                    )}
                                                    title={`Momentum: ${sig.momentum_status}`}
                                                >
                                                    {sig.momentum_icon}
                                                </span>
                                            )}

                                            {/* Warning */}
                                            {sig.warning_status && sig.warning_status !== "NO_WARNINGS" && sig.warning_count > 0 && (
                                                <span
                                                    className={cn(
                                                        "text-[11px] px-1.5 py-0.5",
                                                        sig.warning_status === "HIGH_RISK" ? "animate-pulse" : ""
                                                    )}
                                                    title={sig.warnings?.map((w: any) => w.message).join(', ')}
                                                >
                                                    {sig.warnings && sig.warnings.length > 0 ? sig.warnings[0].icon : '⚠️'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Hover Overlay */}
                                    <div className={cn(
                                        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
                                        "bg-gradient-to-br from-transparent via-transparent to-white/5"
                                    )} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto scrollbar-thin scrollbar-thumb-zinc-800">
                {/* Symbol Summary Card */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Active Ticker</span>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-2xl font-black text-blue-400">
                                {(() => {
                                    let cleanSymbol = String(symbol || '');
                                    cleanSymbol = cleanSymbol.replace(/\|?Add\s+\w+\s+to\s+Watchlist/gi, '').trim();
                                    cleanSymbol = cleanSymbol.replace(/\|?Remove\s+from\s+Watchlist/gi, '').trim();
                                    cleanSymbol = cleanSymbol.replace(/^\|+|\|+$/g, '').trim();
                                    return cleanSymbol;
                                })()}
                            </h2>
                            <span className="text-[10px] text-zinc-600 font-bold">{method === 'm' ? 'Market Maker' : method === 'nr' ? 'Non-Retail' : 'Foreign Flow'}</span>
                        </div>
                    </div>
                    {chartData.length > 0 && (
                        <>
                            <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                                <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Latest Price</span>
                                <div className="text-2xl font-black text-white">
                                    {chartData[chartData.length - 1].price?.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                                <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Total Markers (30D)</span>
                                <div className="flex gap-2">
                                    <div className="text-2xl font-black text-pink-500">
                                        {chartData.filter(d => d.isCrossing || d.isUnusual || d.isPinky).length}
                                    </div>
                                    <div className="text-[8px] flex flex-col justify-center text-zinc-500 leading-tight">
                                        <span>Detected</span>
                                        <span>Potential Accum</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                                <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Net Flow Trend</span>
                                <div className={cn("text-[14px] font-black tracking-tighter", chartData.reduce((acc, curr) => acc + curr.activeFlow, 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                                    {chartData.reduce((acc, curr) => acc + curr.activeFlow, 0) >= 0 ? 'ACCUMULATING' : 'DISTRIBUTING'}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Chart Section */}
                <div className="bg-[#181a1f] border border-zinc-800/50 rounded-md p-4 h-[500px] flex flex-col relative w-full">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <h3 className="text-xs font-bold text-zinc-400">Price vs {getMetricLabel(flowMetric)} Correlation</h3>
                        </div>
                        <div className="flex gap-4 text-[9px] font-bold">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" /> PRICE</div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500/30 border border-emerald-500/50 rounded-sm" /> POSITIVE FLOW (B)</div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500/30 border border-red-500/50 rounded-sm" /> NEGATIVE FLOW (B)</div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
                            <span className="text-[10px] text-blue-400 font-bold tracking-[0.2em]">FETCHING HISTORY...</span>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-red-500">
                            <AlertCircle className="w-8 h-8 opacity-50" />
                            <span className="text-[10px] font-bold">{error}</span>
                        </div>
                    ) : (
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <defs>
                                        <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#52525b"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        stroke="#52525b"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => val.toLocaleString()}
                                        domain={['auto', 'auto']}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#52525b"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => val.toLocaleString() + 'B'}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1 }} />

                                    {/* Bar Chart for Flow */}
                                    <Bar yAxisId="right" dataKey="activeFlow">
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.activeFlow >= 0 ? '#10b981' : '#ef4444'}
                                                fillOpacity={0.3}
                                                stroke={entry.activeFlow >= 0 ? '#10b981' : '#ef4444'}
                                                strokeWidth={1}
                                                strokeOpacity={0.5}
                                            />
                                        ))}
                                    </Bar>

                                    {/* Line Chart for Price */}
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="price"
                                        stroke="#3b82f6"
                                        strokeWidth={3}
                                        dot={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            const hasMarker = payload.isCrossing || payload.isUnusual || payload.isPinky;
                                            if (hasMarker) {
                                                return (
                                                    <circle
                                                        key={`marker-${payload.scraped_at}`}
                                                        cx={cx}
                                                        cy={cy}
                                                        r={6}
                                                        fill="#ec4899"
                                                        strokeWidth={2}
                                                        stroke="#fff"
                                                        className="animate-pulse cursor-help"
                                                    />
                                                );
                                            }
                                            return <circle key={`dot-${payload.scraped_at}`} cx={cx} cy={cy} r={2} fill="#3b82f6" stroke="none" />;
                                        }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* History Table */}
                <div className="bg-[#181a1f] border border-zinc-800/50 rounded-md overflow-hidden">
                    <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-zinc-500" />
                            <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-widest">Historical Breakdown</h3>
                        </div>
                        <div className="text-[9px] text-zinc-500 italic uppercase">
                            All flow values in <span className="text-blue-400 font-bold">Billions IDR (Miliar)</span>
                        </div>
                    </div>
                    <div className="max-h-[300px] overflow-auto scrollbar-thin scrollbar-thumb-zinc-800">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="sticky top-0 bg-[#23252b] z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Price</th>
                                    <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Change</th>
                                    <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Money Flow</th>
                                    <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider text-center">Markers</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {chartData.slice().reverse().map((row, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-800/40 transition-colors h-[32px]">
                                        <td className="px-4 py-1.5 border-r border-zinc-800 text-zinc-400 font-mono">{row.scraped_at}</td>
                                        <td className="px-4 py-1.5 border-r border-zinc-800 text-zinc-200 font-bold">{row.price?.toLocaleString()}</td>
                                        <td className={cn("px-4 py-1.5 border-r border-zinc-800 font-bold", row.pct_change >= 0 ? "text-emerald-400" : "text-red-400")}>
                                            {row.pct_change > 0 && '+'}{row.pct_change?.toFixed(2)}%
                                        </td>
                                        <td className={cn("px-4 py-1.5 border-r border-zinc-800 font-bold", row.activeFlow >= 0 ? "text-emerald-400" : "text-red-400")}>
                                            {row.activeFlow?.toLocaleString()} <span className="text-[8px] opacity-40">B</span>
                                        </td>
                                        <td className="px-4 py-1.5 border-r border-zinc-800 text-center">
                                            <div className="flex justify-center gap-1">
                                                {row.isCrossing && <div className="w-2 h-2 rounded-full bg-pink-500 shadow-sm shadow-pink-500/50" title="Crossing" />}
                                                {row.isUnusual && <div className="w-2 h-2 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" title="Unusual" />}
                                                {row.isPinky && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" title="Pinky" />}
                                                {!row.isCrossing && !row.isUnusual && !row.isPinky && <span className="text-zinc-700">-</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {chartData.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-zinc-600 italic">No historical data available. Perform a sync first.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Footer Stats */}
            <div className="bg-[#181a1f] border-t border-zinc-800 px-4 py-1 text-[9px] text-zinc-500 flex justify-between items-center h-[30px]">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><InfoIcon className="w-3 h-3" /> Data Flow diukur dalam <span className="text-blue-400 font-bold">Miliar IDR</span>.</span>
                    <span className="flex items-center gap-1"><HistoryIcon className="w-3 h-3" /> [D] = Hari, [W] = Minggu, [C] = Kumulatif (Hari).</span>
                </div>
                <div className="flex gap-4 font-bold">
                    <span className="text-pink-500 uppercase tracking-tighter">Pink Markers indicate Potential High Intensity Accumulation</span>
                </div>
            </div>
        </div>
    );
}
