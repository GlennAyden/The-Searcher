'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { useFilter } from '@/context/filter-context';
import {
    RefreshCcw,
    Download,
    AlertCircle,
    ChevronUp,
    ChevronDown,
    Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NeoBDMSummaryPage() {
    const { dateRange } = useFilter();
    const [method, setMethod] = useState('m');
    const [period, setPeriod] = useState('d');
    const [loading, setLoading] = useState(false);
    const [scrapedAt, setScrapedAt] = useState<string | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [isBatchLoading, setIsBatchLoading] = useState(false);

    // New States for Features
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50; // Increased to 50 for ultra-compact view

    // Fetch available dates on mount
    useEffect(() => {
        const fetchDates = async () => {
            try {
                const json = await api.getNeoBDMDates();
                if (json.dates && json.dates.length > 0) {
                    setAvailableDates(json.dates);
                    // Default to latest
                    // setSelectedDate(json.dates[0]); // Optional: auto-select latest
                }
            } catch (e) {
                console.error("Failed to fetch dates", e);
            }
        };
        fetchDates();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Always load from database (no direct scraping)
            const result = await api.getNeoBDMSummary(
                method,
                period,
                false, // Never scrape directly
                selectedDate || undefined,
                selectedDate || undefined
            );

            setData(result.data);
            setScrapedAt(result.scraped_at);
        } catch (err: any) {
            setError(err.message || "Failed to load NeoBDM summary");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [method, period, selectedDate]); // Reload when parameters change

    const handleBatchSync = async () => {
        setIsBatchLoading(true);
        setError(null);
        try {
            const result = await api.runNeoBDMBatchScrape();
            if (result.status === 'success') {
                const dateJson = await api.getNeoBDMDates();
                if (dateJson.dates) setAvailableDates(dateJson.dates);
                loadData();
            }
        } catch (err: any) {
            setError(err.message || "Batch sync failed");
        } finally {
            setIsBatchLoading(false);
        }
    };

    const handleFilterChange = (col: string, val: string) => {
        setFilters(prev => ({ ...prev, [col]: val }));
    };

    const handleSort = (key: string) => {
        if (sortConfig?.key === key) {
            if (sortConfig.direction === 'asc') {
                setSortConfig({ key, direction: 'desc' });
            } else {
                setSortConfig(null);
            }
        } else {
            setSortConfig({ key, direction: 'asc' });
        }
    };

    const getColumns = () => {
        if (data.length === 0) return [];
        const availableKeys = Object.keys(data[0]);

        const dailyOrder = [
            'symbol', 'pinky', 'crossing', 'unusual', 'likuid',
            'w-4', 'w-3', 'w-2', 'w-1',
            'd-4', 'd-3', 'd-2', 'd-0',
            '%1d', 'price', '>ma5', '>ma10', '>ma20', '>ma50', '>ma100'
        ];

        const cumulativeOrder = [
            'symbol', 'pinky', 'crossing', 'unusual', 'likuid',
            'c-20', 'c-10', 'c-5', 'c-3',
            '%3d', '%5d', '%10d', '%20d',
            'price', '>ma5', '>ma10', '>ma20', '>ma50', '>ma100'
        ];

        const targetOrder = period === 'd' ? dailyOrder : cumulativeOrder;

        return targetOrder.filter(targetCol =>
            availableKeys.some(key => key.toLowerCase() === targetCol.toLowerCase())
        ).map(targetCol => {
            const actualKey = availableKeys.find(key => key.toLowerCase() === targetCol.toLowerCase());
            return actualKey || targetCol;
        });
    };

    const allColumns = getColumns();

    const evaluateFilter = (cellValue: any, filterExpr: string): boolean => {
        if (!filterExpr) return true;

        const cellStr = String(cellValue || '').trim();
        const filterStr = filterExpr.trim();

        // Handle multiple conditions with & (AND logic)
        if (filterStr.includes('&')) {
            const conditions = filterStr.split('&').map(s => s.trim());
            return conditions.every(cond => evaluateFilter(cellValue, cond));
        }

        // Check for comparison operators
        const match = filterStr.match(/^(>=|<=|>|<|=)(.+)$/);

        if (match) {
            const operator = match[1];
            const targetVal = match[2].trim();

            // Try to parse as numbers (remove commas first)
            const cellNum = parseFloat(cellStr.replace(/,/g, ''));
            const targetNum = parseFloat(targetVal.replace(/,/g, ''));

            // If both are valid numbers, do numeric comparison
            if (!isNaN(cellNum) && !isNaN(targetNum)) {
                switch (operator) {
                    case '>': return cellNum > targetNum;
                    case '<': return cellNum < targetNum;
                    case '>=': return cellNum >= targetNum;
                    case '<=': return cellNum <= targetNum;
                    case '=': return cellNum === targetNum;
                }
            }

            // Fallback to string comparison
            if (operator === '=') {
                return cellStr.toLowerCase() === targetVal.toLowerCase();
            }
        }

        // Default: substring match (case-insensitive)
        return cellStr.toLowerCase().includes(filterStr.toLowerCase());
    };

    const processedData = useMemo(() => {
        // 1. Filter with advanced logic
        let result = data.filter(row => {
            return Object.entries(filters).every(([col, val]) => {
                if (!val) return true;
                return evaluateFilter(row[col], val);
            });
        });

        // 2. Sort
        if (sortConfig) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];

                const numA = parseFloat(String(valA).replace(/,/g, ''));
                const numB = parseFloat(String(valB).replace(/,/g, ''));

                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
                }

                // Fallback to string sort
                const strA = String(valA || '').toLowerCase();
                const strB = String(valB || '').toLowerCase();
                if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [data, filters, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(processedData.length / pageSize);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return processedData.slice(start, start + pageSize);
    }, [processedData, currentPage]);

    // Reset page when filters/data change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, method, period, selectedDate]);

    const getAnalysisTitle = () => {
        const labels: Record<string, string> = {
            'm': 'Market Maker Analysis',
            'nr': 'Non-Retail Flow',
            'f': 'Foreign Flow Analysis'
        };
        return labels[method] || 'Market Analysis';
    };

    return (
        <div className="flex flex-col gap-0 p-0 min-h-screen bg-[#0f1115] text-zinc-100 font-mono">
            {/* Header / Config Bar */}
            <div className="flex flex-wrap items-center justify-between gap-1 bg-[#181a1f] p-1 border-b border-zinc-800/60 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
                <div className="flex items-center gap-3">
                    {/* Method Selector */}
                    <div className="space-y-0.5">
                        <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Metode Analisa</label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="block w-48 bg-[#23252b] border border-zinc-700/50 text-zinc-200 text-[10px] rounded-sm py-0.5 px-1 outline-none focus:border-blue-500/50 cursor-pointer transition-all"
                        >
                            <option value="m">Market Maker Analysis</option>
                            <option value="nr">Non-Retail Flow</option>
                            <option value="f">Foreign Flow Analysis</option>
                        </select>
                    </div>

                    {/* Period Selector */}
                    <div className="space-y-0.5">
                        <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Periode</label>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="block w-28 bg-[#23252b] border border-zinc-700/50 text-zinc-200 text-[10px] rounded-sm py-0.5 px-1 outline-none focus:border-blue-500/50 cursor-pointer transition-all"
                        >
                            <option value="d">Daily</option>
                            <option value="c">Cumulative</option>
                        </select>
                    </div>

                    {/* Date Selector */}
                    <div className="space-y-0.5">
                        <label className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block flex items-center gap-1">
                            <Calendar className="w-2 h-2" /> Tanggal Data
                        </label>
                        <select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="block w-32 bg-[#23252b] border border-zinc-700/50 text-yellow-400 font-bold text-[10px] rounded-sm py-0.5 px-1 outline-none focus:border-yellow-500/50 cursor-pointer transition-all"
                        >
                            <option value="">Latest Scrape</option>
                            {availableDates.map(date => (
                                <option key={date} value={date}>{date}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBatchSync}
                        disabled={loading || isBatchLoading}
                        className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:opacity-90 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-[10px] font-bold shadow-lg transition-all active:scale-95 flex items-center gap-1"
                    >
                        {isBatchLoading && <RefreshCcw className="w-2.5 h-2.5 animate-spin" />}
                        {isBatchLoading ? "Syncing All..." : "Full Sync"}
                    </button>
                    {scrapedAt && (
                        <div className="text-[10px] text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/50 font-medium">
                            UPDATED: <span className="text-zinc-300">{scrapedAt}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Title Row */}
            <div className="bg-[#181a1f] border-b border-zinc-800 px-4 py-1 flex items-center justify-between">
                <h2 className="text-zinc-100 text-[14px] font-bold tracking-tight">
                    {getAnalysisTitle()} <span className="text-zinc-500 font-normal">|</span> <span className="text-blue-400">{period === 'c' ? 'Cumulative' : 'Daily'}</span>
                </h2>
                <div className="text-[10px] text-zinc-600 italic">
                    {processedData.length} records found
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-hidden relative bg-[#0f1115]">
                {(loading || isBatchLoading) && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3">
                        <RefreshCcw className="w-10 h-10 text-blue-500 animate-spin" />
                        <span className="text-blue-400 text-xs font-mono animate-pulse">
                            {isBatchLoading ? "Running Full Sync (Methods x Periods)..." : "Synchronizing with NeoBDM..."}
                        </span>
                        {isBatchLoading && (
                            <span className="text-[10px] text-zinc-500 max-w-xs text-center px-4">
                                This process iterates through all analysis methods and periods. Please do not close this window.
                            </span>
                        )}
                    </div>
                )}

                <div className="overflow-auto h-full scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <table className="w-auto text-left text-[11px] border-collapse leading-none tracking-tight user-select-text table-fixed">
                        <thead className="sticky top-0 z-20 shadow-md">
                            {/* Sort Header */}
                            <tr className="bg-[#eab308] text-black border-b border-yellow-600">
                                {allColumns.map((col) => {
                                    const isSorted = sortConfig?.key === col;

                                    // Calculate dynamic width based on column type
                                    const colLower = col.toLowerCase();
                                    let widthClass = "w-[65px] max-w-[65px]"; // Aggressive default
                                    if (colLower === 'symbol') widthClass = "w-[140px] max-w-[140px]";
                                    else if (['pinky', 'crossing', 'unusual', 'likuid'].includes(colLower)) widthClass = "w-[45px] max-w-[45px]";
                                    else if (colLower.startsWith('w-') || colLower.startsWith('d-') || colLower.startsWith('c-')) widthClass = "w-[65px] max-w-[65px]";
                                    else if (colLower.includes('ma') || colLower === 'price') widthClass = "w-[100px] max-w-[100px]";

                                    return (
                                        <th
                                            key={col}
                                            onClick={() => handleSort(col)}
                                            className={cn(
                                                "px-0 py-2 font-extrabold text-[#1a1a1a] uppercase text-[12px] tracking-tight border-r border-yellow-600/20 cursor-pointer hover:bg-[#ca8a04] transition-colors select-none group relative whitespace-nowrap overflow-hidden text-ellipsis",
                                                widthClass
                                            )}
                                        >
                                            <div className="flex items-center justify-center gap-0">
                                                {col.toLowerCase()}
                                                <div className="flex flex-col opacity-30 group-hover:opacity-100 transition-opacity">
                                                    <ChevronUp className={cn("w-1 h-1", isSorted && sortConfig?.direction === 'asc' && "text-black opacity-100")} />
                                                    <ChevronDown className={cn("w-1 h-1 -mt-0.5", isSorted && sortConfig?.direction === 'desc' && "text-black opacity-100")} />
                                                </div>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>

                            {/* Filter Row */}
                            <tr className="bg-[#1f2937] border-b border-zinc-700">
                                {allColumns.map((col, idx) => (
                                    <th key={`filter-${col}`} className="p-0 border-r border-zinc-700/50">
                                        <input
                                            type="text"
                                            placeholder=""
                                            title="Operators: >, <, >=, <=, = | Multi: & | Example: >100 or >=50&<=200"
                                            value={filters[col] || ''}
                                            onChange={(e) => handleFilterChange(col, e.target.value)}
                                            className="w-full bg-[#111827] border-none text-zinc-300 text-[12px] px-2 py-1 outline-none focus:bg-zinc-800 text-center placeholder:text-zinc-700 h-[28px]"
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="bg-[#0f1115] divide-y divide-zinc-800/50">
                            {paginatedData.length > 0 ? (
                                paginatedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-800/40 transition-colors group h-[30px]">
                                        {allColumns.map((col) => {
                                            const val = row[col];
                                            let valStr = String(val || '');

                                            // Clean unwanted text patterns (Watchlist, etc.)
                                            valStr = valStr.replace(/\|?Add\s+\w+\s+to\s+Watchlist/gi, '').trim();
                                            valStr = valStr.replace(/\|?Remove\s+from\s+Watchlist/gi, '').trim();
                                            // Remove leading/trailing pipe symbols
                                            valStr = valStr.replace(/^\|+|\|+$/g, '').trim();

                                            const isNegative = valStr.startsWith('-');

                                            let textColor = "text-zinc-400";
                                            let bgColor = "transparent";

                                            const colLower = col.toLowerCase();
                                            const isSymbol = colLower === 'symbol';
                                            const valLower = valStr.toLowerCase();

                                            // Text Coloring
                                            if (isNegative) {
                                                textColor = "text-red-400";
                                            } else if (!['x', 'v'].includes(valLower) && !isNaN(parseFloat(valStr.replace(/,/g, ''))) && parseFloat(valStr.replace(/,/g, '')) > 0) {
                                                textColor = "text-emerald-400";
                                            }
                                            if (isSymbol) textColor = "text-blue-300 font-bold";

                                            // Badge / Background Logic
                                            if (['crossing', 'unusual', 'pinky'].includes(colLower) && valLower === 'v') {
                                                bgColor = "bg-pink-500/20";
                                                textColor = "text-pink-400 font-bold";
                                            }
                                            if (valLower === 'bullish') textColor = "text-green-400";
                                            if (valLower === 'bearish') textColor = "text-red-400";

                                            return (
                                                <td
                                                    key={col}
                                                    className={cn(
                                                        "px-2 py-1 text-center border-r border-zinc-800/30 whitespace-nowrap text-[12px] font-bold leading-normal tracking-normal overflow-hidden text-ellipsis",
                                                        bgColor
                                                    )}
                                                >
                                                    <div className={cn("flex items-center justify-center", textColor)}>
                                                        {isSymbol && (
                                                            <span className="text-yellow-500/50 mr-0.5 text-[8px] group-hover:text-yellow-400 transition-colors">★</span>
                                                        )}
                                                        {isSymbol ? valStr.replace('⭐', '') : valStr}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={allColumns.length} className="px-4 py-32 text-center text-zinc-600 italic">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="w-6 h-6 opacity-20" />
                                            <span>No data matches your criteria.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-[#181a1f] border-t border-zinc-800 px-2 py-0.5 text-[9px] text-zinc-500 flex justify-between items-center select-none h-[28px]">
                <div className="flex gap-4 items-center">
                    <span>Showing {paginatedData.length} of {processedData.length} rows</span>
                    {error && <span className="text-red-500 flex items-center gap-1 font-bold"><AlertCircle className="w-3 h-3" /> {error}</span>}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-1.5 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 text-[8px]"
                    >
                        Prev
                    </button>
                    <span className="text-zinc-400 text-[8px] mx-1">Page {currentPage} of {totalPages || 1}</span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-1.5 py-0.5 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 text-[8px]"
                    >
                        Next
                    </button>
                </div>

                <div className="flex gap-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer text-[8px]">
                    <span className="flex items-center gap-1"><Download className="w-2.5 h-2.5" /> Export CSV</span>
                </div>
            </div>
        </div>
    );
}
