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
    Plus,
    X,
    Database,
    Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api as generalApi } from '@/services/api';
import { neobdmApi, type BrokerFiveItem } from '@/services/api/neobdm';
import type { FloorPriceAnalysis } from '@/services/api/neobdm';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Combine APIs for this page (neobdmApi has getTopHolders)
const api = { ...generalApi, ...neobdmApi };

// --- Scrape Status Component ---
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ScrapeStatusData {
    ticker: string;
    last_scraped: string;
    total_records: number;
}

const ScrapeStatusModal = () => {
    const [statusData, setStatusData] = useState<ScrapeStatusData[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const data = await api.getScrapeStatus();
            setStatusData(data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate status color
    const getStatusColor = (dateStr: string) => {
        const today = new Date();
        const lastDate = new Date(dateStr);
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; // Today/Yesterday
        if (diffDays <= 3) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; // Recent
        return "bg-red-500/20 text-red-400 border-red-500/30"; // Old
    };

    return (
        <Dialog onOpenChange={(open: boolean) => open && fetchStatus()}>
            <DialogTrigger asChild>
                <button
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700/50"
                    title="Check Data Status"
                >
                    <Database className="w-4 h-4" />
                    Data Status
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-blue-500" />
                            Scrape Data Status
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Status Table */}
                    <div className="border border-zinc-800 rounded-md bg-zinc-900/20">
                        <div className="grid grid-cols-4 bg-zinc-900/80 p-3 text-xs font-bold text-zinc-400 border-b border-zinc-800">
                            <div>TICKER</div>
                            <div>LAST SCRAPED</div>
                            <div>TOTAL RECORDS</div>
                            <div>STATUS</div>
                        </div>
                        <ScrollArea className="h-[400px]">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-zinc-500">
                                    <RefreshCcw className="w-6 h-6 animate-spin" />
                                </div>
                            ) : statusData.length === 0 ? (
                                <div className="flex items-center justify-center p-8 text-zinc-500">
                                    No data found.
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-800/50">
                                    {statusData.map((item) => (
                                        <div key={item.ticker} className="grid grid-cols-4 p-3 text-sm hover:bg-zinc-900/40 transition-colors items-center">
                                            <div className="font-bold text-zinc-200">{item.ticker}</div>
                                            <div className="font-mono text-zinc-400">{item.last_scraped}</div>
                                            <div className="font-mono text-zinc-400">{item.total_records.toLocaleString()}</div>
                                            <div>
                                                <Badge variant="outline" className={cn("text-[10px] uppercase", getStatusColor(item.last_scraped))}>
                                                    {item.last_scraped === new Date().toISOString().split('T')[0] ? "Up to Date" : "Outdated"}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default function BrokerSummaryPage() {
    const [ticker, setTicker] = useState('');
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

    // Date Range State
    const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [buyData, setBuyData] = useState<any[]>([]);
    const [sellData, setSellData] = useState<any[]>([]);

    // Broker Journey State
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [journeyStartDate, setJourneyStartDate] = useState('');
    const [journeyEndDate, setJourneyEndDate] = useState('');
    const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
    const [newBrokerCode, setNewBrokerCode] = useState('');
    const [journeyData, setJourneyData] = useState<any>(null);
    const [loadingJourney, setLoadingJourney] = useState(false);
    const [showAllDates, setShowAllDates] = useState(false);

    // Top Holders State
    const [topHolders, setTopHolders] = useState<any[]>([]);
    const [loadingTopHolders, setLoadingTopHolders] = useState(false);

    // Broker 5% State
    const [brokerFiveItems, setBrokerFiveItems] = useState<BrokerFiveItem[]>([]);
    const [brokerFiveLoading, setBrokerFiveLoading] = useState(false);
    const [brokerFiveSaving, setBrokerFiveSaving] = useState(false);
    const [brokerFiveError, setBrokerFiveError] = useState<string | null>(null);
    const [newBrokerFiveCode, setNewBrokerFiveCode] = useState('');
    const [editingBrokerFiveId, setEditingBrokerFiveId] = useState<number | null>(null);
    const [editingBrokerFiveCode, setEditingBrokerFiveCode] = useState('');

    // Floor Price State
    const [floorPriceData, setFloorPriceData] = useState<FloorPriceAnalysis | null>(null);
    const [loadingFloorPrice, setLoadingFloorPrice] = useState(false);
    const [floorPriceDays, setFloorPriceDays] = useState<number>(30); // 0 = all data

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

    const sortBrokerFiveItems = (items: BrokerFiveItem[]) => {
        return [...items].sort((a, b) => a.broker_code.localeCompare(b.broker_code));
    };

    const activeBrokerFiveTicker = ticker.trim().toUpperCase();
    const canUseBrokerFive = activeBrokerFiveTicker.length >= 4 && !tickerError;

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

    const loadBrokerFive = async (targetTicker?: string) => {
        const loadTicker = (targetTicker || activeBrokerFiveTicker).trim().toUpperCase();
        if (loadTicker.length < 4 || tickerError) {
            setBrokerFiveItems([]);
            return;
        }
        setBrokerFiveLoading(true);
        setBrokerFiveError(null);
        try {
            const data = await api.getBrokerFiveList(loadTicker);
            setBrokerFiveItems(sortBrokerFiveItems(data.items || []));
        } catch (err: any) {
            setBrokerFiveError(err.message || "Failed to load Broker 5% list");
        } finally {
            setBrokerFiveLoading(false);
        }
    };

    const handleAddBrokerFive = async () => {
        const code = newBrokerFiveCode.trim().toUpperCase();
        if (!canUseBrokerFive) {
            setBrokerFiveError("Masukkan ticker yang valid terlebih dahulu.");
            return;
        }
        if (!code) return;
        setBrokerFiveSaving(true);
        setBrokerFiveError(null);
        try {
            const data = await api.createBrokerFive({ ticker: activeBrokerFiveTicker, broker_code: code });
            setBrokerFiveItems((prev) => sortBrokerFiveItems([...prev, data.item]));
            setNewBrokerFiveCode('');
        } catch (err: any) {
            setBrokerFiveError(err.message || "Failed to add broker code");
        } finally {
            setBrokerFiveSaving(false);
        }
    };

    const handleStartEditBrokerFive = (item: BrokerFiveItem) => {
        setEditingBrokerFiveId(item.id);
        setEditingBrokerFiveCode(item.broker_code);
    };

    const handleCancelEditBrokerFive = () => {
        setEditingBrokerFiveId(null);
        setEditingBrokerFiveCode('');
    };

    const handleSaveBrokerFive = async () => {
        if (!editingBrokerFiveId) return;
        if (!canUseBrokerFive) {
            setBrokerFiveError("Masukkan ticker yang valid terlebih dahulu.");
            return;
        }
        const code = editingBrokerFiveCode.trim().toUpperCase();
        if (!code) return;
        setBrokerFiveSaving(true);
        setBrokerFiveError(null);
        try {
            const data = await api.updateBrokerFive(editingBrokerFiveId, { ticker: activeBrokerFiveTicker, broker_code: code });
            setBrokerFiveItems((prev) =>
                sortBrokerFiveItems(prev.map((item) => (item.id === editingBrokerFiveId ? data.item : item)))
            );
            handleCancelEditBrokerFive();
        } catch (err: any) {
            setBrokerFiveError(err.message || "Failed to update broker code");
        } finally {
            setBrokerFiveSaving(false);
        }
    };

    const handleDeleteBrokerFive = async (id: number) => {
        if (!canUseBrokerFive) {
            setBrokerFiveError("Masukkan ticker yang valid terlebih dahulu.");
            return;
        }
        setBrokerFiveSaving(true);
        setBrokerFiveError(null);
        try {
            await api.deleteBrokerFive(id, activeBrokerFiveTicker);
            setBrokerFiveItems((prev) => prev.filter((item) => item.id !== id));
            if (editingBrokerFiveId === id) {
                handleCancelEditBrokerFive();
            }
        } catch (err: any) {
            setBrokerFiveError(err.message || "Failed to delete broker code");
        } finally {
            setBrokerFiveSaving(false);
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
        if (!canUseBrokerFive) {
            setBrokerFiveItems([]);
            setEditingBrokerFiveId(null);
            setEditingBrokerFiveCode('');
            setBrokerFiveError(null);
            return;
        }
        loadBrokerFive(activeBrokerFiveTicker);
    }, [activeBrokerFiveTicker, tickerError]);

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
    const loadJourneyData = async () => {
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
        } catch (err: any) {
            console.error('Failed to load journey data:', err);
            setJourneyData(null);
        } finally {
            setLoadingJourney(false);
        }
    };

    useEffect(() => {
        loadJourneyData();
    }, [ticker, selectedBrokers, journeyStartDate, journeyEndDate]);

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

                    {/* TOP 3 HOLDERS SECTION */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            Top 3 Holders - {ticker || 'Select a ticker'}
                        </h2>

                        {loadingTopHolders ? (
                            <div className="h-[200px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                        ) : topHolders.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {topHolders.map((holder, idx) => {
                                    const rankColors = [
                                        { border: 'border-amber-500/40', bg: 'bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
                                        { border: 'border-zinc-500/40', bg: 'bg-zinc-500/5', badge: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30' },
                                        { border: 'border-orange-700/40', bg: 'bg-orange-700/5', badge: 'bg-orange-700/20 text-orange-400 border border-orange-700/30' },
                                    ];
                                    const color = rankColors[idx] || rankColors[2];

                                    return (
                                        <motion.div
                                            key={holder.broker_code}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className={cn(
                                                "bg-gradient-to-br from-zinc-900/80 to-zinc-900/50 border rounded-2xl p-5 space-y-3 shadow-lg",
                                                color.border
                                            )}
                                        >
                                            {/* Position Badge */}
                                            <div className="flex items-center justify-between">
                                                <div className={cn("text-xs px-3 py-1 rounded-full font-black", color.badge)}>
                                                    #{idx + 1} HOLDER
                                                </div>
                                            </div>

                                            {/* Broker Code */}
                                            <div>
                                                <div className="text-3xl font-black text-white tracking-tight">
                                                    {holder.broker_code}
                                                </div>
                                            </div>

                                            {/* Net Position */}
                                            <div className="space-y-2 pt-2 border-t border-zinc-800">
                                                <div>
                                                    <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1 flex items-center gap-1">
                                                        Total Net Lot (Sisa Barang)
                                                        <div className="group relative">
                                                            <Info className="w-3 h-3 text-zinc-700 hover:text-zinc-500 cursor-help" />
                                                            <div className="invisible group-hover:visible absolute left-0 top-4 w-48 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-[9px] text-zinc-300 normal-case font-normal shadow-xl z-50">
                                                                NET position (Buy - Sell). Menunjukkan akumulasi sebenarnya setelah memperhitungkan buy dan sell.
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                                                        +{formatNumber(holder.total_net_lot)} lot
                                                        <TrendingUp className="w-5 h-5" />
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">
                                                        Total Net Value
                                                    </div>
                                                    <div className="text-lg font-black text-blue-400">
                                                        {formatNumber(holder.total_net_value, 1)}B
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Trade Stats */}
                                            <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800/50">
                                                <div>
                                                    <div className="text-zinc-600 font-bold">Trades</div>
                                                    <div className="text-zinc-400 font-black">{holder.trade_count} days</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-zinc-600 font-bold">Period</div>
                                                    <div className="text-zinc-400 font-black">
                                                        {holder.first_date.substring(5)} - {holder.last_date.substring(5)}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : ticker && ticker.length >= 4 ? (
                            <div className="h-[200px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <div className="text-zinc-600 text-sm font-bold">No top holders data</div>
                                    <div className="text-zinc-700 text-xs">
                                        No broker summary data available for {ticker}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[200px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                                    <div className="text-zinc-600 text-sm font-bold">Enter a ticker to see top holders</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* FLOOR PRICE ANALYSIS SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-teal-500" />
                                Floor Price Analysis - {ticker || 'Select a ticker'}
                                <div className="group relative">
                                    <Info className="w-4 h-4 text-zinc-600 hover:text-zinc-400 cursor-help" />
                                    <div className="invisible group-hover:visible absolute left-0 top-6 w-72 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-[10px] text-zinc-300 normal-case font-normal shadow-xl z-50">
                                        <div className="font-bold mb-1">Floor Price Methodology:</div>
                                        Dihitung dari <span className="text-teal-400 font-bold">TOTAL BUY</span> saja, tidak dikurangi SELL. Ini menunjukkan di harga berapa institutional buyers masuk, bukan holdings mereka saat ini.
                                    </div>
                                </div>
                            </h2>
                            {/* Toggle: 30 Days vs All Data */}
                            <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
                                <button
                                    onClick={() => setFloorPriceDays(30)}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        floorPriceDays === 30
                                            ? "bg-teal-500 text-white"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    )}
                                >
                                    30 Hari
                                </button>
                                <button
                                    onClick={() => setFloorPriceDays(0)}
                                    className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                        floorPriceDays === 0
                                            ? "bg-teal-500 text-white"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    )}
                                >
                                    Semua Data
                                </button>
                            </div>
                        </div>

                        {loadingFloorPrice ? (
                            <div className="h-[180px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <RefreshCcw className="w-8 h-8 text-teal-500 animate-spin" />
                            </div>
                        ) : floorPriceData && floorPriceData.confidence !== 'NO_DATA' ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-zinc-900/80 to-zinc-900/50 border border-teal-500/30 rounded-2xl p-5 shadow-lg"
                            >
                                <div className="flex flex-col md:flex-row gap-4">
                                    {/* Floor Price Display */}
                                    <div className="flex-shrink-0 px-6 py-4 rounded-xl bg-teal-500/10 border border-teal-500/30 flex flex-col items-center justify-center min-w-[160px]">
                                        <span className="text-[10px] text-zinc-500 uppercase mb-1">Estimated Floor Price</span>
                                        <span className="text-3xl font-black text-teal-400">
                                            Rp {formatNumber(floorPriceData.floor_price)}
                                        </span>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full mt-2 font-bold",
                                            floorPriceData.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-400' :
                                                floorPriceData.confidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-zinc-500/20 text-zinc-400'
                                        )}>
                                            {floorPriceData.confidence} CONFIDENCE
                                        </span>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase">Institutional Gross Buy</div>
                                            <div className="text-lg font-bold text-blue-400">{formatNumber(floorPriceData.institutional_buy_lot)} lot</div>
                                            <div className="text-[10px] text-zinc-600">{formatNumber(floorPriceData.institutional_buy_value, 2)}B</div>
                                        </div>
                                        <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase">Foreign Gross Buy</div>
                                            <div className="text-lg font-bold text-purple-400">{formatNumber(floorPriceData.foreign_buy_lot || 0)} lot</div>
                                            <div className="text-[10px] text-zinc-600">{formatNumber(floorPriceData.foreign_buy_value || 0, 2)}B</div>
                                        </div>
                                        <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase">Days Analyzed</div>
                                            <div className="text-lg font-bold text-white">{floorPriceData.days_analyzed}</div>
                                        </div>
                                        <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                                            <div className="text-[10px] text-zinc-500 uppercase">Latest Data</div>
                                            <div className="text-sm font-bold text-zinc-400">{floorPriceData.latest_date?.substring(5) || '-'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Top Institutional Brokers */}
                                {floorPriceData.institutional_brokers.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-zinc-800">
                                        <div className="text-[10px] text-zinc-500 mb-2">Top Institutional Gross Buyers (Total Buy Volume)</div>
                                        <div className="flex flex-wrap gap-2">
                                            {floorPriceData.institutional_brokers.slice(0, 6).map(broker => (
                                                <div key={broker.code} className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 text-xs">
                                                    <span className="font-bold text-blue-400">{broker.code}</span>
                                                    <span className="text-zinc-500 ml-2">Rp {formatNumber(broker.avg_price)}</span>
                                                    <span className="text-zinc-600 ml-1">({formatNumber(broker.total_lot)} lot)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : ticker && ticker.length >= 4 ? (
                            <div className="h-[180px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <div className="text-zinc-600 text-sm font-bold">No floor price data</div>
                                    <div className="text-zinc-700 text-xs">
                                        No institutional broker summary data available for {ticker}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[180px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                                    <div className="text-zinc-600 text-sm font-bold">Enter a ticker to see floor price</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BROKER JOURNEY SECTION - FULL WIDTH */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                Broker Journey : {ticker || 'Select a ticker'}
                            </h2>
                        </div>

                        {/* Available Dates Display */}
                        {availableDates.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <div className="text-[10px] font-bold text-zinc-600 uppercase">
                                        Available Dates ({availableDates.length} days)
                                    </div>
                                    {availableDates.length > 15 && (
                                        <button
                                            onClick={() => setShowAllDates(!showAllDates)}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold px-2 py-0.5 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-all flex items-center gap-1"
                                        >
                                            {showAllDates ? (
                                                <>
                                                    <X className="w-3 h-3" />
                                                    Show Less
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="w-3 h-3" />
                                                    Show All ({availableDates.length})
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <div className={cn(
                                    "flex flex-wrap gap-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900",
                                    showAllDates ? "max-h-40" : "max-h-20"
                                )}>
                                    {(showAllDates ? availableDates : availableDates.slice(0, 15)).map(dateVal => (
                                        <button
                                            key={dateVal}
                                            onClick={() => setDate(dateVal)}
                                            className={cn(
                                                "text-[10px] px-2 py-1 rounded border font-bold transition-all",
                                                date === dateVal
                                                    ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20"
                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                                            )}
                                        >
                                            {dateVal.substring(5)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Date Range Selector */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                                <div className="text-[10px] font-bold text-zinc-600 uppercase">Date Range</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">From</label>
                                        <input
                                            type="date"
                                            value={journeyStartDate}
                                            onChange={(e) => setJourneyStartDate(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">To</label>
                                        <input
                                            type="date"
                                            value={journeyEndDate}
                                            onChange={(e) => setJourneyEndDate(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Broker Selector */}
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="text-[10px] font-bold text-zinc-600 uppercase">Tracked Brokers (Max 5)</div>
                                    {buyData.length > 0 && selectedBrokers.length === 0 && (
                                        <button
                                            onClick={() => setSelectedBrokers(buyData.slice(0, 3).map(b => b.broker))}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 font-black flex items-center gap-1 group"
                                        >
                                            <Plus className="w-3 h-3 group-hover:scale-125 transition-transform" />
                                            TRACK TOP 3 BUYERS
                                        </button>
                                    )}
                                </div>

                                {/* Selected Brokers */}
                                <div className="flex flex-wrap gap-2">
                                    {selectedBrokers.map(broker => (
                                        <div
                                            key={broker}
                                            className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold"
                                        >
                                            {broker}
                                            <button
                                                onClick={() => handleRemoveBroker(broker)}
                                                className="hover:text-white transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add Broker Input */}
                                {selectedBrokers.length < 5 && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newBrokerCode}
                                            onChange={(e) => setNewBrokerCode(e.target.value.toUpperCase())}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddBroker()}
                                            placeholder="Broker code (e.g., YP)"
                                            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium flex-1"
                                            maxLength={4}
                                        />
                                        <button
                                            onClick={handleAddBroker}
                                            disabled={!newBrokerCode.trim()}
                                            className={cn(
                                                "p-2 rounded-xl transition-colors",
                                                newBrokerCode.trim()
                                                    ? "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                                                    : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                                            )}
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Journey Chart - FULL WIDTH */}
                        {loadingJourney ? (
                            <div className="h-[500px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                        ) : journeyData && journeyData.brokers && journeyData.brokers.length > 0 ? (
                            <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-bold text-zinc-400">Cumulative Net Position (Billion Rp)</div>
                                    {journeyData.price_data && journeyData.price_data.length > 0 && (
                                        <div className="text-sm font-bold text-red-400">Harga Saham (Rp)</div>
                                    )}
                                </div>

                                <ResponsiveContainer width="100%" height={500}>
                                    <LineChart data={(() => {
                                        // Transform data: create shared dataset with all dates
                                        const allDates = new Set<string>();

                                        // Collect all unique dates from all brokers
                                        journeyData.brokers.forEach((broker: any) => {
                                            broker.daily_data.forEach((day: any) => {
                                                allDates.add(day.date);
                                            });
                                        });

                                        // Also add dates from price data
                                        if (journeyData.price_data) {
                                            journeyData.price_data.forEach((p: any) => {
                                                allDates.add(p.date);
                                            });
                                        }

                                        // Sort dates chronologically
                                        const sortedDates = Array.from(allDates).sort();

                                        // Build shared dataset
                                        return sortedDates.map(date => {
                                            const dataPoint: any = { date };

                                            // For each broker, find the cumulative value on this date
                                            journeyData.brokers.forEach((broker: any) => {
                                                const dayData = broker.daily_data.find((d: any) => d.date === date);
                                                dataPoint[broker.broker_code] = dayData ? dayData.cumulative_net_value : null;
                                            });

                                            // Add price data if available
                                            if (journeyData.price_data) {
                                                const priceEntry = journeyData.price_data.find((p: any) => p.date === date);
                                                dataPoint['Harga'] = priceEntry ? priceEntry.close_price : null;
                                            }

                                            return dataPoint;
                                        });
                                    })()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#71717a"
                                            style={{ fontSize: '11px', fontWeight: 'bold' }}
                                            tickFormatter={(value) => value.substring(5)}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#71717a"
                                            style={{ fontSize: '11px', fontWeight: 'bold' }}
                                            tickFormatter={(value) => value.toFixed(1)}
                                        />
                                        {journeyData.price_data && journeyData.price_data.length > 0 && (
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#ef4444"
                                                style={{ fontSize: '11px', fontWeight: 'bold' }}
                                                tickFormatter={(value) => value.toLocaleString()}
                                            />
                                        )}
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#18181b',
                                                border: '1px solid #3f3f46',
                                                borderRadius: '8px',
                                                fontSize: '12px'
                                            }}
                                            formatter={(value: any, name?: string) => {
                                                if (name === 'Harga') {
                                                    return [value ? `Rp ${value.toLocaleString()}` : '-', 'Harga Saham'];
                                                }
                                                return [value !== null ? `${value.toFixed(2)}B` : '-', name ?? ''];
                                            }}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        />

                                        {journeyData.brokers.map((broker: any, idx: number) => {
                                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                                            return (
                                                <Line
                                                    key={broker.broker_code}
                                                    yAxisId="left"
                                                    dataKey={broker.broker_code}
                                                    type="monotoneX"
                                                    name={broker.broker_code}
                                                    stroke={colors[idx % colors.length]}
                                                    strokeWidth={1.5}
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                    connectNulls={true}
                                                />
                                            );
                                        })}

                                        {journeyData.price_data && journeyData.price_data.length > 0 && (
                                            <Line
                                                yAxisId="right"
                                                dataKey="Harga"
                                                type="monotoneX"
                                                name="Harga"
                                                stroke="#ef4444"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={{ r: 2, fill: '#ef4444' }}
                                                activeDot={{ r: 4 }}
                                                connectNulls={true}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[500px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <div className="text-zinc-600 text-sm font-bold">No journey data</div>
                                    <div className="text-zinc-700 text-xs">
                                        {selectedBrokers.length === 0
                                            ? "Add brokers to track their journey"
                                            : "No activity found for selected brokers in this period"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Broker Statistics - BELOW CHART */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            Broker Statistics
                        </h2>

                        {journeyData && journeyData.brokers && journeyData.brokers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                {journeyData.brokers.map((broker: any, idx: number) => {
                                    const colors = [
                                        { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'bg-blue-500' },
                                        { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500' },
                                        { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500' },
                                        { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400', badge: 'bg-purple-500' },
                                        { bg: 'bg-pink-500/5', border: 'border-pink-500/20', text: 'text-pink-400', badge: 'bg-pink-500' },
                                    ];
                                    const color = colors[idx % colors.length];
                                    const isAccumulating = broker.summary.is_accumulating;

                                    return (
                                        <motion.div
                                            key={broker.broker_code}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className={cn(
                                                "bg-[#0c0c0e] border rounded-2xl overflow-hidden shadow-lg",
                                                color.border
                                            )}
                                        >
                                            <div className={cn("px-4 py-3 border-b border-zinc-800/50 flex justify-between items-center", color.bg)}>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full", color.badge)} />
                                                    <span className={cn("text-sm font-black uppercase", color.text)}>
                                                        {broker.broker_code}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded border font-bold",
                                                        isAccumulating
                                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                            : "bg-red-500/10 text-red-400 border-red-500/20"
                                                    )}>
                                                        {isAccumulating ? "ACCUMULATING" : "DISTRIBUTING"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Buy</div>
                                                        <div className="text-lg font-black text-emerald-400">
                                                            {formatNumber(broker.summary.total_buy_value, 1)}B
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500">
                                                            {formatNumber(broker.summary.total_buy_lot)} lot
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Sell</div>
                                                        <div className="text-lg font-black text-red-400">
                                                            {formatNumber(broker.summary.total_sell_value, 1)}B
                                                        </div>
                                                        <div className="text-[10px] text-zinc-500">
                                                            {formatNumber(broker.summary.total_sell_lot)} lot
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-3 border-t border-zinc-800 space-y-2">
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Net Position</div>
                                                            <div className={cn(
                                                                "text-xl font-black flex items-center gap-1",
                                                                isAccumulating ? "text-emerald-400" : "text-red-400"
                                                            )}>
                                                                {isAccumulating ? "+" : ""}{formatNumber(broker.summary.net_value, 1)}B
                                                                {isAccumulating ? <ArrowUpRight className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[9px] text-zinc-600 font-bold uppercase">Days Active</div>
                                                            <div className="text-lg font-black text-zinc-400">
                                                                {broker.summary.days_active}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* NET LOT DISPLAY (SISA BARANG) */}
                                                    <div className="pt-2 border-t border-zinc-800/50">
                                                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Net Lot (Holdings)</div>
                                                        <div className={cn(
                                                            "text-lg font-black",
                                                            isAccumulating ? "text-blue-400" : "text-orange-400"
                                                        )}>
                                                            {formatNumber(broker.summary.net_lot)} lot
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-8 text-center">
                                <div className="text-zinc-600 text-sm font-bold mb-2">No broker data available</div>
                                <div className="text-zinc-700 text-xs">
                                    Select brokers and a date range to view statistics
                                </div>
                            </div>
                        )}
                    </div>
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

                {/* BROKER 5% CRUD */}
                <section className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between gap-4 border-b border-zinc-800/60 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <Database className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold tracking-tight">Broker 5%</h3>
                                <p className="text-[10px] text-zinc-500 font-medium">Kelola kode broker untuk fokus 5%</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-bold">
                                {canUseBrokerFive ? activeBrokerFiveTicker : 'Pilih ticker'}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-bold">{brokerFiveItems.length} codes</span>
                            <button
                                onClick={() => loadBrokerFive(activeBrokerFiveTicker)}
                                disabled={brokerFiveLoading || !canUseBrokerFive}
                                className={cn(
                                    "p-2 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white transition-colors",
                                    (brokerFiveLoading || !canUseBrokerFive) && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                <RefreshCcw className={cn("w-4 h-4", brokerFiveLoading && "animate-spin")} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Tambah kode broker</label>
                            <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-blue-500/50 transition-colors">
                                <input
                                    type="text"
                                    value={newBrokerFiveCode}
                                    onChange={(e) => setNewBrokerFiveCode(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddBrokerFive()}
                                    placeholder="YP, PD, AK..."
                                    className="bg-transparent border-none outline-none text-sm font-bold w-full uppercase placeholder:text-zinc-700 font-mono"
                                    disabled={brokerFiveSaving || !canUseBrokerFive}
                                />
                                <button
                                    onClick={handleAddBrokerFive}
                                    disabled={brokerFiveSaving || !newBrokerFiveCode.trim() || !canUseBrokerFive}
                                    className={cn(
                                        "p-2 rounded-lg border transition-colors",
                                        brokerFiveSaving || !newBrokerFiveCode.trim() || !canUseBrokerFive
                                            ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
                                            : "border-blue-500/30 text-blue-400 hover:text-blue-300 hover:border-blue-500/60"
                                    )}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {brokerFiveError && (
                                <div className="text-[10px] text-red-400 font-bold px-1">{brokerFiveError}</div>
                            )}
                        </div>

                        <div className="space-y-2">
                            {!canUseBrokerFive ? (
                                <div className="text-[10px] text-zinc-600 italic">Masukkan ticker valid untuk melihat daftar broker 5%.</div>
                            ) : brokerFiveLoading && brokerFiveItems.length === 0 ? (
                                <div className="text-[10px] text-zinc-600 italic">Loading broker list...</div>
                            ) : brokerFiveItems.length === 0 ? (
                                <div className="text-[10px] text-zinc-600 italic">Belum ada kode broker.</div>
                            ) : (
                                brokerFiveItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-2 bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-3 py-2"
                                    >
                                        {editingBrokerFiveId === item.id ? (
                                            <input
                                                type="text"
                                                value={editingBrokerFiveCode}
                                                onChange={(e) => setEditingBrokerFiveCode(e.target.value.toUpperCase())}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveBrokerFive();
                                                    if (e.key === 'Escape') handleCancelEditBrokerFive();
                                                }}
                                                className="bg-transparent border-none outline-none text-sm font-bold uppercase placeholder:text-zinc-700 font-mono flex-1"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="text-sm font-black font-mono text-zinc-200">{item.broker_code}</span>
                                        )}

                                        <div className="flex items-center gap-2">
                                            {editingBrokerFiveId === item.id ? (
                                                <>
                                                    <button
                                                        onClick={handleSaveBrokerFive}
                                                        disabled={brokerFiveSaving || !editingBrokerFiveCode.trim()}
                                                        className={cn(
                                                            "px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors",
                                                            brokerFiveSaving || !editingBrokerFiveCode.trim()
                                                                ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
                                                                : "border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/60"
                                                        )}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEditBrokerFive}
                                                        className="px-2 py-1 rounded-lg text-[10px] font-bold border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleStartEditBrokerFive(item)}
                                                        disabled={brokerFiveSaving}
                                                        className={cn(
                                                            "px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors",
                                                            brokerFiveSaving
                                                                ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
                                                                : "border-blue-500/30 text-blue-400 hover:text-blue-300 hover:border-blue-500/60"
                                                        )}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBrokerFive(item.id)}
                                                        disabled={brokerFiveSaving}
                                                        className={cn(
                                                            "px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors",
                                                            brokerFiveSaving
                                                                ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
                                                                : "border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/60"
                                                        )}
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
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
            </main >

            {/* Batch Sync Modal */}
            <AnimatePresence>
                {
                    showBatchModal && (
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

                                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50">
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
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-zinc-600 font-bold">{batchDates.length} days selected</span>
                                                {batchDates.length > 0 && (
                                                    <button
                                                        onClick={() => setBatchDates([])}
                                                        className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-all"
                                                    >
                                                        Clear All
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 min-h-[60px] max-h-[200px] overflow-y-auto p-4 bg-zinc-900/30 border-2 border-dashed border-zinc-800 rounded-2xl scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50">
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

                                        {batchDates.length > 8 && (
                                            <p className="text-[9px] text-amber-400/80 font-bold px-1 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Scroll to see all dates
                                            </p>
                                        )}


                                        {/* Mode Toggle */}
                                        <div className="flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl w-full mb-3">
                                            <button
                                                onClick={() => setDateMode('single')}
                                                className={cn(
                                                    "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                                    dateMode === 'single'
                                                        ? "bg-blue-500 text-white shadow-lg"
                                                        : "text-zinc-500 hover:text-zinc-300"
                                                )}
                                            >
                                                Single Date
                                            </button>
                                            <button
                                                onClick={() => setDateMode('range')}
                                                className={cn(
                                                    "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                                    dateMode === 'range'
                                                        ? "bg-blue-500 text-white shadow-lg"
                                                        : "text-zinc-500 hover:text-zinc-300"
                                                )}
                                            >
                                                Date Range
                                            </button>
                                        </div>

                                        {/* Single Date Mode */}
                                        {dateMode === 'single' && (
                                            <div className="flex items-center gap-2">
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
                                        )}

                                        {/* Date Range Mode */}
                                        {dateMode === 'range' && (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">From</label>
                                                        <input
                                                            type="date"
                                                            value={startDate}
                                                            onChange={(e) => setStartDate(e.target.value)}
                                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-zinc-600 uppercase px-1">To</label>
                                                        <input
                                                            type="date"
                                                            value={endDate}
                                                            onChange={(e) => setEndDate(e.target.value)}
                                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-medium [color-scheme:dark]"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleGenerateDateRange}
                                                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                                                >
                                                    Generate Dates in Range
                                                </button>
                                                <p className="text-[10px] text-zinc-500 text-center mt-2">
                                                    âœ“ Weekends & holidays automatically excluded
                                                </p>
                                            </div>
                                        )}
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
                    )
                }
            </AnimatePresence >
        </div >
    );
}
