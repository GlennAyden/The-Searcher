'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    ArrowRightLeft,
    Search,
    Calendar,
    Filter,
    ArrowUpRight,
    Info,
    RefreshCcw,
    AlertCircle,
    CheckCircle2,
    Layers,
    Plus,
    X,
    Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

export default function BrokerSummaryPage() {
    const [ticker, setTicker] = useState('ANTM');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [hoveredBroker, setHoveredBroker] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [issuerTickers, setIssuerTickers] = useState<string[]>([]);
    const [tickerError, setTickerError] = useState<string | null>(null);
    const [invalidBatchTickers, setInvalidBatchTickers] = useState<string[]>([]);

    // Batch Scraping State
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchTickers, setBatchTickers] = useState<string>('');
    const [batchDates, setBatchDates] = useState<string[]>([]);
    const [newBatchDate, setNewBatchDate] = useState(new Date().toISOString().split('T')[0]);

    const [buyData, setBuyData] = useState<any[]>([]);
    const [sellData, setSellData] = useState<any[]>([]);

    const toNumber = (value: any) => {
        if (value === null || value === undefined) return 0;
        const num = Number(String(value).replace(/,/g, ''));
        return Number.isFinite(num) ? num : 0;
    };

    const formatNumber = (value: any, digits = 0) => {
        const num = toNumber(value);
        return num.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    };

    const issuerTickerSet = useMemo(() => {
        return new Set(issuerTickers.map((item) => item.toUpperCase()));
    }, [issuerTickers]);

    const shouldValidateTicker = issuerTickerSet.size > 0 && ticker.length >= 4;

    const loadData = async (forceScrape = false) => {
        if (forceScrape) setSyncing(true);
        else setLoading(true);

        setError(null);
        setSuccess(null);

        try {
            const data = await api.getNeoBDMBrokerSummary(ticker, date, forceScrape);
            setBuyData(data.buy || []);
            setSellData(data.sell || []);

            if (forceScrape) {
                setSuccess(data.source === 'scraper' ? "Sync completed successfully!" : "Data fetched from database.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to load broker summary");
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    const handleBatchSync = async () => {
        const tickers = batchTickers.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
        if (tickers.length === 0 || batchDates.length === 0) {
            setError("Please provide at least one ticker and one date.");
            return;
        }
        if (issuerTickerSet.size > 0) {
            const invalidTickers = tickers.filter((t) => !issuerTickerSet.has(t));
            if (invalidTickers.length > 0) {
                setError(`Ticker tidak dikenal: ${invalidTickers.join(', ')}`);
                return;
            }
        }

        setSyncing(true);
        setSuccess(null);
        setError(null);
        setShowBatchModal(false);

        try {
            const tasks = tickers.map(t => ({ ticker: t, dates: batchDates }));
            const result = await api.runNeoBDMBrokerSummaryBatch(tasks);
            setSuccess(result.message);
        } catch (err: any) {
            setError(err.message || "Failed to start batch sync");
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        api.getIssuerTickers()
            .then((tickers) => {
                if (isMounted) setIssuerTickers(tickers || []);
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!shouldValidateTicker) {
            setTickerError(null);
            return;
        }
        if (!issuerTickerSet.has(ticker)) {
            setTickerError(`Ticker ${ticker} tidak ditemukan di daftar emiten.`);
            return;
        }
        setTickerError(null);
    }, [issuerTickerSet, shouldValidateTicker, ticker]);

    useEffect(() => {
        if (issuerTickerSet.size === 0) {
            setInvalidBatchTickers([]);
            return;
        }
        const tickers = batchTickers.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
        const invalid = tickers.filter((t) => t.length >= 4 && !issuerTickerSet.has(t));
        setInvalidBatchTickers(invalid);
    }, [batchTickers, issuerTickerSet]);

    useEffect(() => {
        if (ticker.length < 4) return;
        if (tickerError) {
            setBuyData([]);
            setSellData([]);
            return;
        }
        loadData();
    }, [ticker, date, tickerError]);

    const totalVal = useMemo(() => {
        const buyVal = buyData.reduce((acc, curr) => acc + toNumber(curr.nval), 0);
        const sellVal = sellData.reduce((acc, curr) => acc + toNumber(curr.nval), 0);
        return ((buyVal + sellVal) / 2).toFixed(1);
    }, [buyData, sellData]);

    const isBullish = useMemo(() => {
        const topBuy = toNumber(buyData[0]?.nval);
        const topSell = toNumber(sellData[0]?.nval);
        return topBuy > topSell;
    }, [buyData, sellData]);

    const flows = useMemo(() => {
        if (!buyData.length || !sellData.length) return [];
        return buyData.slice(0, 4).map((b, i) => ({
            from: b.broker,
            to: sellData[i % sellData.length]?.broker,
            value: toNumber(b.nval)
        }));
    }, [buyData, sellData]);

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-blue-500/30 pb-12">
            <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Broker Analysis</h1>
                        <p className="text-xs text-zinc-500 font-medium">Flow Distribution Summary</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                        <div
                            className={cn(
                                "flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-1.5 transition-colors",
                                tickerError ? "border-red-500/60" : "focus-within:border-blue-500/50"
                            )}
                        >
                            <Search className="w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                placeholder="TICKER..."
                                className="bg-transparent border-none outline-none text-sm font-bold w-24 uppercase placeholder:text-zinc-700 font-mono"
                                aria-invalid={!!tickerError}
                            />
                        </div>
                        {tickerError && (
                            <span className="text-[10px] text-red-400 font-bold">{tickerError}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-1.5 focus-within:border-blue-500/50 transition-colors">
                        <Calendar className="w-4 h-4 text-zinc-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-medium [color-scheme:dark]"
                        />
                    </div>

                    <div className="flex items-center gap-2 ml-2">
                        <button
                            onClick={() => {
                                setBatchTickers(ticker);
                                if (batchDates.length === 0) setBatchDates([date]);
                                setShowBatchModal(true);
                            }}
                            disabled={syncing || loading}
                            title="Open scraping tools (single or batch)"
                            className={cn(
                                "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95",
                                syncing || loading
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-500/20"
                            )}
                        >
                            <Layers className="w-4 h-4" />
                            Scrape
                        </button>
                    </div>
                </div>
            </header>

            <main className="p-6 max-w-[1600px] mx-auto space-y-6">

                <AnimatePresence>
                    {(error || success) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: -10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -10 }}
                            className={cn(
                                "p-3 rounded-xl flex items-center justify-between gap-3 text-sm border shadow-sm",
                                error ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                {error ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                                <span className="font-medium">{error || success}</span>
                            </div>
                            <button onClick={() => { setError(null); setSuccess(null); }} className="hover:opacity-70">
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
                    {loading && !syncing && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-40 rounded-3xl flex items-center justify-center">
                            <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    )}

                    <div className="lg:col-span-12 xl:col-span-7 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                Distribution Flow : {ticker}
                            </h2>
                            <div className="flex gap-2">
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">BUYER</span>
                                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold">SELLER</span>
                            </div>
                        </div>

                        <div className="relative h-[450px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl overflow-hidden group">
                            <div className="absolute inset-0 opacity-[0.03]"
                                style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
                            />

                            <div className="relative h-full flex justify-between items-center px-12 py-8">
                                <div className="flex flex-col justify-between h-full w-32 relative z-10">
                                    {buyData.slice(0, 5).map((b, i) => (
                                        <motion.div
                                            key={`${b.broker}-${ticker}-${date}`}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            onHoverStart={() => setHoveredBroker(b.broker)}
                                            onHoverEnd={() => setHoveredBroker(null)}
                                            className={cn(
                                                "p-3 bg-[#18181b] border border-zinc-800 rounded-xl cursor-default transition-all shadow-sm",
                                                hoveredBroker === b.broker && "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-105 z-20"
                                            )}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-black text-blue-400 uppercase">{b.broker}</span>
                                                <span className="text-[10px] text-zinc-500 font-bold">{formatNumber(b.nval, 1)}B</span>
                                            </div>
                                            <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-blue-500"
                                                    initial={{ width: 0 }}
                                                    animate={{
                                                        width: `${Math.min((toNumber(b.nval) / (toNumber(buyData[0]?.nval) * 1.5 || 100)) * 100, 100)}%`
                                                    }}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                    {!buyData.length && !loading && (
                                        <div className="h-full flex items-center justify-center text-zinc-700 text-[10px] font-bold uppercase italic border-2 border-dashed border-zinc-900 rounded-2xl px-4 text-center">
                                            No Buyers Found
                                        </div>
                                    )}
                                </div>

                                <svg key={`${ticker}-${date}`} className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                                    <defs>
                                        <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                                        </linearGradient>
                                    </defs>
                                    {flows.map((flow, idx) => (
                                        <motion.path
                                            key={idx}
                                            d={`M 120,${60 + (idx % 5) * 85} C 350,${60 + (idx % 5) * 85} 350,${80 + (idx % 5) * 85} 580,${80 + (idx % 5) * 85}`}
                                            stroke="url(#flow-gradient)"
                                            strokeWidth={Math.max(flow.value * 0.5, 2)}
                                            fill="none"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0, opacity: 0 }}
                                            animate={{ pathLength: 1, opacity: 1 }}
                                            transition={{ duration: 1.5, delay: 0.5 + idx * 0.2 }}
                                        />
                                    ))}
                                </svg>

                                <div className="flex flex-col justify-between h-full w-32 relative z-10">
                                    {sellData.slice(0, 5).map((s, i) => (
                                        <motion.div
                                            key={`${s.broker}-${ticker}-${date}`}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 + 0.5 }}
                                            onHoverStart={() => setHoveredBroker(s.broker)}
                                            onHoverEnd={() => setHoveredBroker(null)}
                                            className={cn(
                                                "p-3 bg-[#18181b] border border-zinc-800 rounded-xl cursor-default transition-all shadow-sm",
                                                hoveredBroker === s.broker && "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] scale-105 z-20"
                                            )}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-black text-red-400 uppercase">{s.broker}</span>
                                                <span className="text-[10px] text-zinc-500 font-bold">{formatNumber(s.nval, 1)}B</span>
                                            </div>
                                            <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-red-500"
                                                    initial={{ width: 0 }}
                                                    animate={{
                                                        width: `${Math.min((toNumber(s.nval) / (toNumber(sellData[0]?.nval) * 1.5 || 100)) * 100, 100)}%`
                                                    }}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                    {!sellData.length && !loading && (
                                        <div className="h-full flex items-center justify-center text-zinc-700 text-[10px] font-bold uppercase italic border-2 border-dashed border-zinc-900 rounded-2xl px-4 text-center">
                                            No Sellers Found
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                                <motion.div
                                    key={`${ticker}-${date}-${buyData.length}`}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="bg-[#09090b]/40 backdrop-blur-md p-4 rounded-full border border-zinc-800/50 shadow-2xl"
                                >
                                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">Net Flow Status</div>
                                    <div className={cn("text-xl font-black px-4", isBullish ? "text-emerald-400" : "text-red-400")}>
                                        {buyData.length || sellData.length ? (isBullish ? 'ACCUMULATION' : 'DISTRIBUTION') : 'NO DATA'}
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-4">
                        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            Summary Ledger: {ticker}
                        </h2>

                        <div className="grid grid-cols-2 gap-4 h-full">
                            <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col shadow-lg min-h-[400px]">
                                <div className="px-4 py-3 bg-emerald-500/5 border-b border-zinc-800/50 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase">Top Buyers</span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-medium text-emerald-500/60 uppercase tracking-wider">In Flow</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto scrollbar-hide">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 bg-[#0c0c0e]/95 backdrop-blur-md z-10 border-b border-zinc-800">
                                            <tr className="text-[9px] text-zinc-500 font-bold uppercase">
                                                <th className="px-4 py-2">BRK</th>
                                                <th className="px-1 py-2 text-right">NLOT</th>
                                                <th className="px-1 py-2 text-right">VAL(B)</th>
                                                <th className="px-4 py-2 text-right">AVG</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[11px]">
                                            {buyData.map((row, i) => (
                                                <motion.tr
                                                    key={`${row.broker}-${i}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className="border-b border-zinc-900 last:border-0 hover:bg-zinc-800/30 transition-colors cursor-default"
                                                >
                                                    <td className="px-4 py-3 font-black text-zinc-300 font-mono">{row.broker}</td>
                                                    <td className="px-1 py-3 text-right font-bold text-zinc-300">{formatNumber(row.nlot)}</td>
                                                    <td className="px-1 py-3 text-right font-bold text-emerald-400/90">{formatNumber(row.nval, 1)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-zinc-400">{formatNumber(row.avg_price)}</td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col shadow-lg min-h-[400px]">
                                <div className="px-4 py-3 bg-red-500/5 border-b border-zinc-800/50 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-red-400 uppercase">Top Sellers</span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-[9px] font-medium text-red-500/60 uppercase tracking-wider">Out Flow</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto scrollbar-hide">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 bg-[#0c0c0e]/95 backdrop-blur-md z-10 border-b border-zinc-800">
                                            <tr className="text-[9px] text-zinc-500 font-bold uppercase">
                                                <th className="px-4 py-2">BRK</th>
                                                <th className="px-1 py-2 text-right">NLOT</th>
                                                <th className="px-1 py-2 text-right">VAL(B)</th>
                                                <th className="px-4 py-2 text-right">AVG</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-[11px]">
                                            {sellData.map((row, i) => (
                                                <motion.tr
                                                    key={`${row.broker}-${i}`}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className="border-b border-zinc-900 last:border-0 hover:bg-zinc-800/30 transition-colors cursor-default"
                                                >
                                                    <td className="px-4 py-3 font-black text-zinc-300 font-mono">{row.broker}</td>
                                                    <td className="px-1 py-3 text-right font-bold text-zinc-300">{formatNumber(row.nlot)}</td>
                                                    <td className="px-1 py-3 text-right font-bold text-red-400/90">{formatNumber(row.nval, 1)}</td>
                                                    <td className="px-4 py-3 text-right font-mono text-zinc-400">{formatNumber(row.avg_price)}</td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Avg Trade Val', val: `${totalVal}B`, icon: ArrowUpRight, color: 'text-blue-400' },
                        { label: 'Buy Concentration', val: `${buyData.length > 0 ? ((buyData[0]?.nval / (parseFloat(totalVal) || 1)) * 100).toFixed(1) : 0}%`, icon: Filter, color: 'text-zinc-400' },
                        { label: 'Price Reference', val: formatNumber((toNumber(buyData[0]?.avg_price) + toNumber(sellData[0]?.avg_price)) / 2), icon: Info, color: 'text-zinc-400' },
                        { label: 'Data Points', val: buyData.length + sellData.length, icon: TrendingUp, color: isBullish ? 'text-emerald-400' : 'text-red-400' },
                    ].map((card, i) => (
                        <motion.div
                            key={`${card.label}-${ticker}-${date}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-[#0c0c0e] border border-zinc-800/50 p-4 rounded-2xl flex items-center justify-between group hover:border-zinc-700 transition-all shadow-md"
                        >
                            <div>
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{card.label}</p>
                                <p className={cn("text-xl font-black mt-1", card.color)}>{card.val}</p>
                            </div>
                            <div className="p-2 bg-zinc-900/50 rounded-lg group-hover:scale-110 transition-transform">
                                <card.icon className={cn("w-5 h-5", card.color)} />
                            </div>
                        </motion.div>
                    ))}
                </section>
            </main>

            {/* Batch Sync Modal */}
            <AnimatePresence>
                {showBatchModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                                <div className="flex items-center gap-3">
                                    <Layers className="w-5 h-5 text-blue-400" />
                                    <h3 className="font-bold">Scrape Engine</h3>
                                </div>
                                <button onClick={() => setShowBatchModal(false)} className="text-zinc-500 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Ticker(s) (comma separated)</label>
                                    <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 focus-within:border-blue-500/50 transition-colors">
                                        <Search className="w-4 h-4 text-zinc-600" />
                                        <input
                                            type="text"
                                            value={batchTickers}
                                            onChange={(e) => setBatchTickers(e.target.value.toUpperCase())}
                                            placeholder="BBCA, ANTM, TLKM..."
                                            className="bg-transparent border-none outline-none text-sm font-bold w-full uppercase placeholder:text-zinc-700 font-mono"
                                        />
                                    </div>
                                    {invalidBatchTickers.length > 0 && (
                                        <div className="text-[10px] text-red-400 font-bold px-1">
                                            Ticker tidak dikenal: {invalidBatchTickers.join(', ')}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Selected Dates</label>
                                        <span className="text-[10px] text-zinc-600 font-bold">{batchDates.length} days selected</span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
                                        {batchDates.map((d) => (
                                            <div key={d} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
                                                {d}
                                                <button onClick={() => setBatchDates(prev => prev.filter(x => x !== d))}>
                                                    <X className="w-3 h-3 hover:text-white" />
                                                </button>
                                            </div>
                                        ))}
                                        {batchDates.length === 0 && (
                                            <span className="text-zinc-700 text-xs italic p-1">No dates added yet...</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <input
                                            type="date"
                                            value={newBatchDate}
                                            onChange={(e) => setNewBatchDate(e.target.value)}
                                            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark] flex-1"
                                        />
                                        <button
                                            onClick={() => {
                                                if (!batchDates.includes(newBatchDate)) {
                                                    setBatchDates(prev => [...prev, newBatchDate].sort().reverse());
                                                }
                                            }}
                                            className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex gap-4">
                                    <Database className="w-6 h-6 text-blue-400/50 mt-1" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-blue-300">Background Processing</p>
                                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                                            Scrape runs in the background. Browser sessions are reused for maximum efficiency.
                                            Scraped records will appear in the database as they finish.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex gap-3">
                                <button
                                    onClick={() => setShowBatchModal(false)}
                                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all font-mono"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={handleBatchSync}
                                    disabled={batchDates.length === 0 || !batchTickers.trim() || invalidBatchTickers.length > 0}
                                    className={cn(
                                        "flex-[2] py-3 rounded-2xl text-sm font-bold transition-all shadow-xl active:scale-95",
                                        batchDates.length > 0 && batchTickers.trim() && invalidBatchTickers.length === 0
                                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
                                            : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                    )}
                                >
                                    START SCRAPE
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
