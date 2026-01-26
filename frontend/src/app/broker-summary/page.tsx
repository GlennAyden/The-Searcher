'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    X,
    Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { neobdmApi, type TopHolderItem } from '@/services/api/neobdm';
import type { FloorPriceAnalysis } from '@/services/api/neobdm';
import { dashboardApi } from '@/services/api/dashboard';
import { ScrapeStatusModal } from '@/features/neobdm/broker-summary/components/ScrapeStatusModal';
import { BatchSyncModal } from '@/features/neobdm/broker-summary/components/BatchSyncModal';
import { BrokerFiveSection } from '@/features/neobdm/broker-summary/components/BrokerFiveSection';
import { TopHoldersSection } from '@/features/neobdm/broker-summary/components/TopHoldersSection';
import { FloorPriceSection } from '@/features/neobdm/broker-summary/components/FloorPriceSection';
import { BrokerJourneySection } from '@/features/neobdm/broker-summary/components/BrokerJourneySection';
import { useBrokerSummaryData } from '@/features/neobdm/broker-summary/hooks/useBrokerSummaryData';
import type { BrokerJourneyResponse } from '@/features/neobdm/broker-summary/types';

// Combine APIs for this page (neobdmApi has getTopHolders)
const api = { ...dashboardApi, ...neobdmApi };

export default function BrokerSummaryPage() {
    const [ticker, setTicker] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [issuerTickers, setIssuerTickers] = useState<string[]>([]);
    const [tickerError, setTickerError] = useState<string | null>(null);
    const [invalidBatchTickers, setInvalidBatchTickers] = useState<string[]>([]);

    // Batch Scraping State
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchTickers, setBatchTickers] = useState<string>('');
    const [batchDates, setBatchDates] = useState<string[]>([]);
    const [newBatchDate, setNewBatchDate] = useState(new Date().toISOString().split('T')[0]);

    // Date Range State
    const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const {
        buyData,
        sellData,
        loading,
        syncing,
        error,
        success,
        setError,
        setSuccess,
        setSyncing
    } = useBrokerSummaryData({ ticker, date, tickerError });

    // Broker Journey State
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [journeyStartDate, setJourneyStartDate] = useState('');
    const [journeyEndDate, setJourneyEndDate] = useState('');
    const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
    const [newBrokerCode, setNewBrokerCode] = useState('');
    const [journeyData, setJourneyData] = useState<BrokerJourneyResponse | null>(null);
    const [loadingJourney, setLoadingJourney] = useState(false);
    const [showAllDates, setShowAllDates] = useState(false);

    // Top Holders State
    const [topHolders, setTopHolders] = useState<TopHolderItem[]>([]);
    const [loadingTopHolders, setLoadingTopHolders] = useState(false);

    // Floor Price State
    const [floorPriceData, setFloorPriceData] = useState<FloorPriceAnalysis | null>(null);
    const [loadingFloorPrice, setLoadingFloorPrice] = useState(false);
    const [floorPriceDays, setFloorPriceDays] = useState<number>(30); // 0 = all data

    const toNumber = (value: unknown) => {
        if (value === null || value === undefined) return 0;
        const num = Number(String(value).replace(/,/g, ''));
        return Number.isFinite(num) ? num : 0;
    };

    const formatNumber = (value: unknown, digits = 0) => {
        const num = toNumber(value);
        return num.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    };

    const getErrorMessage = (err: unknown, fallback: string) => {
        if (err instanceof Error && err.message) return err.message;
        if (typeof err === 'string' && err.trim()) return err;
        return fallback;
    };

    const isWeekend = (date: Date): boolean => {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    };

    const isHoliday = (date: Date): boolean => {
        const dateStr = date.toISOString().split('T')[0];

        // Indonesian National Holidays 2025-2026 (approximate - should ideally fetch from API)
        const holidays2025 = [
            '2025-01-01', // New Year
            '2025-03-29', // Nyepi (Hindu New Year)
            '2025-03-31', // Eid al-Fitr Holiday
            '2025-04-01', '2025-04-02', // Eid al-Fitr
            '2025-04-18', // Good Friday
            '2025-05-01', // Labor Day
            '2025-05-29', // Ascension of Jesus
            '2025-06-01', // Pancasila Day
            '2025-06-07', // Eid al-Adha
            '2025-06-28', // Islamic New Year
            '2025-08-17', // Independence Day
            '2025-09-06', // Mawlid (Prophet's Birthday)
            '2025-12-25', // Christmas
            '2025-12-26', // Joint Holiday
        ];

        const holidays2026 = [
            '2026-01-01', // New Year
            '2026-02-17', // Chinese New Year
            '2026-03-19', // Nyepi
            '2026-03-21', '2026-03-22', // Eid al-Fitr
            '2026-04-03', // Good Friday
            '2026-05-01', // Labor Day
            '2026-05-14', // Ascension of Jesus
            '2026-05-27', // Eid al-Adha
            '2026-06-01', // Pancasila Day
            '2026-06-17', // Islamic New Year
            '2026-08-17', // Independence Day
            '2026-08-26', // Mawlid
            '2026-12-25', // Christmas
        ];

        const allHolidays = [...holidays2025, ...holidays2026];
        return allHolidays.includes(dateStr);
    };

    const isTradingDay = (date: Date): boolean => {
        return !isWeekend(date) && !isHoliday(date);
    };

    const generateDateRange = (start: string, end: string): string[] => {
        const dates: string[] = [];
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);

        if (startDateObj > endDateObj) {
            return [];
        }

        const currentDate = new Date(startDateObj);
        while (currentDate <= endDateObj) {
            // Only add trading days (exclude weekends and holidays)
            if (isTradingDay(currentDate)) {
                dates.push(currentDate.toISOString().split('T')[0]);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    };

    const handleGenerateDateRange = () => {
        const generatedDates = generateDateRange(startDate, endDate);
        if (generatedDates.length > 0) {
            // Merge with existing dates and remove duplicates, then sort
            const uniqueDates = Array.from(new Set([...batchDates, ...generatedDates]));
            setBatchDates(uniqueDates.sort().reverse());
        } else {
            setError('End date must be greater than or equal to start date');
        }
    };

    const issuerTickerSet = useMemo(() => {
        return new Set(issuerTickers.map((item) => item.toUpperCase()));
    }, [issuerTickers]);

    const shouldValidateTicker = issuerTickerSet.size > 0 && ticker.length >= 4;

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
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to start batch sync"));
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
            .catch(() => { });
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

    // Fetch available dates when ticker changes
    useEffect(() => {
        if (!ticker || ticker.length < 4) {
            setAvailableDates([]);
            return;
        }

        api.getAvailableDatesForTicker(ticker)
            .then(data => {
                setAvailableDates(data.available_dates || []);
                // Auto-set date range to last 7 available days
                if (data.available_dates && data.available_dates.length > 0) {
                    const sorted = [...data.available_dates].sort().reverse();
                    setJourneyEndDate(sorted[0]);
                    setJourneyStartDate(sorted[Math.min(6, sorted.length - 1)]);
                }
            })
            .catch(err => {
                console.error('Failed to fetch available dates:', err);
                setAvailableDates([]);
            });
    }, [ticker]);

    // Load journey data when parameters change
    const loadJourneyData = useCallback(async () => {
        if (!ticker || selectedBrokers.length === 0 || !journeyStartDate || !journeyEndDate) {
            setJourneyData(null);
            return;
        }

        setLoadingJourney(true);
        try {
            const data = await api.getBrokerJourney(
                ticker,
                selectedBrokers,
                journeyStartDate,
                journeyEndDate
            );
            setJourneyData(data);
        } catch (err: unknown) {
            console.error('Failed to load journey data:', err);
            setJourneyData(null);
        } finally {
            setLoadingJourney(false);
        }
    }, [ticker, selectedBrokers, journeyStartDate, journeyEndDate]);

    useEffect(() => {
        loadJourneyData();
    }, [loadJourneyData]);

    // Load top holders data when ticker changes
    useEffect(() => {
        if (!ticker || ticker.length < 4) {
            setTopHolders([]);
            return;
        }

        setLoadingTopHolders(true);
        api.getTopHolders(ticker, 3)
            .then(data => {
                setTopHolders(data.top_holders || []);
            })
            .catch(err => {
                console.error('Failed to fetch top holders:', err);
                setTopHolders([]);
            })
            .finally(() => {
                setLoadingTopHolders(false);
            });
    }, [ticker]);

    // Load floor price data when ticker or floorPriceDays changes
    useEffect(() => {
        if (!ticker || ticker.length < 4) {
            setFloorPriceData(null);
            return;
        }

        setLoadingFloorPrice(true);
        api.getFloorPriceAnalysis(ticker, floorPriceDays)
            .then(data => {
                setFloorPriceData(data);
            })
            .catch(err => {
                console.error('Failed to fetch floor price:', err);
                setFloorPriceData(null);
            })
            .finally(() => {
                setLoadingFloorPrice(false);
            });
    }, [ticker, floorPriceDays]);

    const handleAddBroker = () => {
        const code = newBrokerCode.trim().toUpperCase();
        if (code && !selectedBrokers.includes(code) && selectedBrokers.length < 5) {
            setSelectedBrokers([...selectedBrokers, code]);
            setNewBrokerCode('');
        }
    };

    const handleRemoveBroker = (broker: string) => {
        setSelectedBrokers(selectedBrokers.filter(b => b !== broker));
    };

    const handleTrackTopBrokers = () => {
        if (buyData.length === 0) return;
        setSelectedBrokers(buyData.slice(0, 3).map((b) => b.broker));
    };

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

                    {/* Scrape Status Button */}
                    <div className="ml-2">
                        <ScrapeStatusModal />
                    </div>
                </div>
            </header >

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

                <section className="space-y-6 relative">
                    {loading && !syncing && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-40 rounded-3xl flex items-center justify-center">
                            <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    )}

                    <TopHoldersSection
                        ticker={ticker}
                        topHolders={topHolders}
                        loading={loadingTopHolders}
                        formatNumber={formatNumber}
                    />

                    <FloorPriceSection
                        ticker={ticker}
                        floorPriceDays={floorPriceDays}
                        onFloorPriceDaysChange={setFloorPriceDays}
                        loading={loadingFloorPrice}
                        floorPriceData={floorPriceData}
                        formatNumber={formatNumber}
                    />

                    <BrokerJourneySection
                        ticker={ticker}
                        date={date}
                        availableDates={availableDates}
                        showAllDates={showAllDates}
                        onToggleShowAllDates={() => setShowAllDates((prev) => !prev)}
                        onSelectDate={setDate}
                        journeyStartDate={journeyStartDate}
                        journeyEndDate={journeyEndDate}
                        onJourneyStartDateChange={setJourneyStartDate}
                        onJourneyEndDateChange={setJourneyEndDate}
                        selectedBrokers={selectedBrokers}
                        newBrokerCode={newBrokerCode}
                        onNewBrokerCodeChange={setNewBrokerCode}
                        onTrackTopBrokers={handleTrackTopBrokers}
                        onAddBroker={handleAddBroker}
                        onRemoveBroker={handleRemoveBroker}
                        buyData={buyData}
                        loading={loadingJourney}
                        journeyData={journeyData}
                        formatNumber={formatNumber}
                    />
                </section>

                {/* DAILY BROKER SUMMARY TABLES (Validation) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top Net Buy */}
                    <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl overflow-hidden shadow-lg">
                        <div className="px-4 py-3 border-b border-zinc-800/50 bg-emerald-500/5 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Top Net Buy
                            </h3>
                            <span className="text-[10px] text-zinc-500 font-bold">{buyData.length} brokers</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-900/40 text-[9px] font-black text-zinc-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-2 border-b border-zinc-800/50">Broker</th>
                                        <th className="px-4 py-2 border-b border-zinc-800/50 text-right">Net Lot</th>
                                        <th className="px-4 py-2 border-b border-zinc-800/50 text-right">Net Val (B)</th>
                                        <th className="px-4 py-2 border-b border-zinc-800/50 text-right">Avg Price</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-medium">
                                    {buyData.length > 0 ? (
                                        buyData.map((row, idx) => (
                                            <tr key={idx} className="border-b border-zinc-800/30 hover:bg-white/[0.02] transition-colors">
                                                <td className="px-4 py-2.5 font-bold text-zinc-300">{row.broker}</td>
                                                <td className="px-4 py-2.5 text-right text-emerald-400/90">{formatNumber(row.nlot)}</td>
                                                <td className="px-4 py-2.5 text-right font-black text-emerald-400">{formatNumber(row.nval, 2)}B</td>
                                                <td className="px-4 py-2.5 text-right text-zinc-400">{formatNumber(row.avg_price)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 text-[10px] italic">No buy data found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Top Net Sell */}
                    <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl overflow-hidden shadow-lg">
                        <div className="px-4 py-3 border-b border-zinc-800/50 bg-red-500/5 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                                Top Net Sell
                            </h3>
                            <span className="text-[10px] text-zinc-500 font-bold">{sellData.length} brokers</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-900/40 text-[9px] font-black text-zinc-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-2 border-b border-zinc-800/50">Broker</th>
                                        <th className="px-4 py-2 border-b border-zinc-800/50 text-right">Net Lot</th>
                                        <th className="px-4 py-2 border-b border-zinc-800/50 text-right">Net Val (B)</th>
                                        <th className="px-4 py-2 border-b border-zinc-800/50 text-right">Avg Price</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-medium">
                                    {sellData.length > 0 ? (
                                        sellData.map((row, idx) => (
                                            <tr key={idx} className="border-b border-zinc-800/30 hover:bg-white/[0.02] transition-colors">
                                                <td className="px-4 py-2.5 font-bold text-zinc-300">{row.broker}</td>
                                                <td className="px-4 py-2.5 text-right text-red-400/90">{formatNumber(row.nlot)}</td>
                                                <td className="px-4 py-2.5 text-right font-black text-red-400">{formatNumber(row.nval, 2)}B</td>
                                                <td className="px-4 py-2.5 text-right text-zinc-400">{formatNumber(row.avg_price)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 text-[10px] italic">No sell data found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <BrokerFiveSection ticker={ticker} tickerError={tickerError} />

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
            </main >

            {/* Batch Sync Modal */}
            <BatchSyncModal
                open={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                batchTickers={batchTickers}
                setBatchTickers={setBatchTickers}
                batchDates={batchDates}
                setBatchDates={setBatchDates}
                invalidBatchTickers={invalidBatchTickers}
                dateMode={dateMode}
                setDateMode={setDateMode}
                newBatchDate={newBatchDate}
                setNewBatchDate={setNewBatchDate}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                onGenerateDateRange={handleGenerateDateRange}
                onConfirm={handleBatchSync}
            />
        </div >
    );
}
