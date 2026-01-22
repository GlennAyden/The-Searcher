'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Filter, X, TrendingUp, TrendingDown, Zap, Target } from "lucide-react";
import { ImposterTrade } from '@/services/api/doneDetail';

interface DetailedImposterTradesProps {
    trades: ImposterTrade[];
    onBrokerClick?: (brokerCode: string) => void;
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

type SortKey = 'trade_date' | 'trade_time' | 'qty' | 'value' | 'broker_code' | 'direction' | 'level';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

interface FilterConfig {
    broker: string;
    direction: 'ALL' | 'BUY' | 'SELL';
    level: 'ALL' | 'STRONG' | 'POSSIBLE';
    dateFilter: string;
}

export const DetailedImposterTrades: React.FC<DetailedImposterTradesProps> = ({
    trades,
    onBrokerClick
}) => {
    // Sort state
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'value', direction: 'desc' });

    // Filter state
    const [filters, setFilters] = useState<FilterConfig>({
        broker: '',
        direction: 'ALL',
        level: 'ALL',
        dateFilter: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    // Calculate summary stats
    const summaryStats = useMemo(() => {
        if (!trades || trades.length === 0) {
            return {
                totalValue: 0,
                totalCount: 0,
                largestTrade: null as ImposterTrade | null,
                mostActiveBroker: { code: '-', count: 0 },
                buyValue: 0,
                sellValue: 0,
                strongCount: 0,
                possibleCount: 0
            };
        }

        let totalValue = 0;
        let buyValue = 0;
        let sellValue = 0;
        let strongCount = 0;
        let possibleCount = 0;
        let largestTrade: ImposterTrade | null = null;
        const brokerCounts: Record<string, number> = {};

        trades.forEach(trade => {
            const value = trade.value || 0;
            totalValue += value;

            if (trade.direction === 'BUY') {
                buyValue += value;
            } else {
                sellValue += value;
            }

            if (trade.level === 'STRONG') {
                strongCount++;
            } else {
                possibleCount++;
            }

            if (!largestTrade || value > (largestTrade.value || 0)) {
                largestTrade = trade;
            }

            brokerCounts[trade.broker_code] = (brokerCounts[trade.broker_code] || 0) + 1;
        });

        // Find most active broker
        let mostActiveBroker = { code: '-', count: 0 };
        Object.entries(brokerCounts).forEach(([code, count]) => {
            if (count > mostActiveBroker.count) {
                mostActiveBroker = { code, count };
            }
        });

        return {
            totalValue,
            totalCount: trades.length,
            largestTrade,
            mostActiveBroker,
            buyValue,
            sellValue,
            strongCount,
            possibleCount
        };
    }, [trades]);

    // Filter and sort trades
    const displayedTrades = useMemo(() => {
        if (!trades) return [];

        let filtered = [...trades];

        // Apply filters
        if (filters.broker) {
            const brokerFilter = filters.broker.toUpperCase();
            filtered = filtered.filter(t =>
                t.broker_code.toUpperCase().includes(brokerFilter) ||
                t.counterparty?.toUpperCase().includes(brokerFilter)
            );
        }

        if (filters.direction !== 'ALL') {
            filtered = filtered.filter(t => t.direction === filters.direction);
        }

        if (filters.level !== 'ALL') {
            filtered = filtered.filter(t => t.level === filters.level);
        }

        if (filters.dateFilter) {
            filtered = filtered.filter(t => t.trade_date?.includes(filters.dateFilter));
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof ImposterTrade];
            let bVal: any = b[sortConfig.key as keyof ImposterTrade];

            // Handle undefined
            if (aVal === undefined) aVal = '';
            if (bVal === undefined) bVal = '';

            // Number comparison
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // String comparison
            const strA = String(aVal);
            const strB = String(bVal);
            return sortConfig.direction === 'asc'
                ? strA.localeCompare(strB)
                : strB.localeCompare(strA);
        });

        return filtered;
    }, [trades, filters, sortConfig]);

    // Get top 5 trade values for highlighting
    const top5Values = useMemo(() => {
        if (!trades || trades.length === 0) return new Set<number>();
        const sorted = [...trades].sort((a, b) => (b.value || 0) - (a.value || 0));
        return new Set(sorted.slice(0, 5).map(t => t.value));
    }, [trades]);

    // Handle sort click
    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Sort indicator component
    const SortIndicator = ({ column }: { column: SortKey }) => {
        if (sortConfig.key !== column) {
            return <ArrowDown className="w-3 h-3 opacity-30" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3 text-teal-400" />
            : <ArrowDown className="w-3 h-3 text-teal-400" />;
    };

    // Clear filters
    const clearFilters = () => {
        setFilters({ broker: '', direction: 'ALL', level: 'ALL', dateFilter: '' });
    };

    const hasActiveFilters = filters.broker || filters.direction !== 'ALL' || filters.level !== 'ALL' || filters.dateFilter;

    // Buy/Sell ratio for visual bar
    const buyRatio = summaryStats.totalValue > 0
        ? (summaryStats.buyValue / summaryStats.totalValue) * 100
        : 50;

    if (!trades || trades.length === 0) {
        return null;
    }

    return (
        <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="py-3 px-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                        🔍 Section 4: Whale Scanner
                        <span className="text-xs text-slate-500 font-normal">
                            ({displayedTrades.length} of {trades.length} trades)
                        </span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="h-6 text-xs text-slate-400 hover:text-white"
                            >
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
            </CardHeader>

            <CardContent className="py-3 px-4">
                {/* Summary Stats Panel */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    {/* Total Value */}
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">Total Value</div>
                        <div className="text-lg font-bold text-orange-400">{formatRupiah(summaryStats.totalValue)}</div>
                    </div>

                    {/* Largest Trade */}
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">Largest Trade</div>
                        <div className="text-lg font-bold text-red-400">
                            {summaryStats.largestTrade ? formatRupiah(summaryStats.largestTrade.value) : '-'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                            {summaryStats.largestTrade?.broker_code || '-'}
                        </div>
                    </div>

                    {/* Most Active Broker */}
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">Most Active</div>
                        <div className="text-lg font-bold text-purple-400">{summaryStats.mostActiveBroker.code}</div>
                        <div className="text-[10px] text-slate-500">{summaryStats.mostActiveBroker.count} trades</div>
                    </div>

                    {/* Strong/Possible */}
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">Strong / Possible</div>
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-lg font-bold text-red-400">{summaryStats.strongCount}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-lg font-bold text-orange-400">{summaryStats.possibleCount}</span>
                        </div>
                    </div>

                    {/* Buy/Sell Ratio */}
                    <div className="bg-slate-800/50 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 uppercase text-center mb-1">Buy vs Sell</div>
                        <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-green-400" />
                            <div className="flex-1 h-2 bg-red-500/30 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 rounded-full transition-all"
                                    style={{ width: `${buyRatio}%` }}
                                />
                            </div>
                            <TrendingDown className="w-3 h-3 text-red-400" />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                            <span>{buyRatio.toFixed(0)}%</span>
                            <span>{(100 - buyRatio).toFixed(0)}%</span>
                        </div>
                    </div>
                </div>

                {/* Quick Filter Bar */}
                {showFilters && (
                    <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-slate-800/30 rounded-lg">
                        <Input
                            placeholder="Broker code..."
                            value={filters.broker}
                            onChange={(e) => setFilters(prev => ({ ...prev, broker: e.target.value }))}
                            className="w-28 h-7 text-xs bg-slate-800 border-slate-600"
                        />
                        <Input
                            placeholder="Date (MM-DD)..."
                            value={filters.dateFilter}
                            onChange={(e) => setFilters(prev => ({ ...prev, dateFilter: e.target.value }))}
                            className="w-28 h-7 text-xs bg-slate-800 border-slate-600"
                        />
                        <div className="flex items-center gap-1">
                            {(['ALL', 'BUY', 'SELL'] as const).map(dir => (
                                <button
                                    key={dir}
                                    onClick={() => setFilters(prev => ({ ...prev, direction: dir }))}
                                    className={`px-2 py-1 text-[10px] rounded ${filters.direction === dir
                                            ? dir === 'BUY' ? 'bg-green-500/30 text-green-400'
                                                : dir === 'SELL' ? 'bg-red-500/30 text-red-400'
                                                    : 'bg-slate-600 text-white'
                                            : 'bg-slate-700 text-slate-400'
                                        }`}
                                >
                                    {dir}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1">
                            {(['ALL', 'STRONG', 'POSSIBLE'] as const).map(lvl => (
                                <button
                                    key={lvl}
                                    onClick={() => setFilters(prev => ({ ...prev, level: lvl }))}
                                    className={`px-2 py-1 text-[10px] rounded ${filters.level === lvl
                                            ? lvl === 'STRONG' ? 'bg-red-500/30 text-red-400'
                                                : lvl === 'POSSIBLE' ? 'bg-orange-500/30 text-orange-400'
                                                    : 'bg-slate-600 text-white'
                                            : 'bg-slate-700 text-slate-400'
                                        }`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1 ml-auto">
                            <button
                                onClick={() => {
                                    setFilters({ broker: '', direction: 'ALL', level: 'STRONG', dateFilter: '' });
                                    setSortConfig({ key: 'value', direction: 'desc' });
                                }}
                                className="px-2 py-1 text-[10px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            >
                                🎯 STRONG Only
                            </button>
                            <button
                                onClick={() => {
                                    clearFilters();
                                    setSortConfig({ key: 'value', direction: 'desc' });
                                }}
                                className="px-2 py-1 text-[10px] rounded bg-teal-500/20 text-teal-400 hover:bg-teal-500/30"
                            >
                                💰 Top by Value
                            </button>
                        </div>
                    </div>
                )}

                {/* Trade Table */}
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-900 z-10">
                            <tr className="border-b border-slate-700">
                                <th
                                    className="text-left py-2 px-3 text-slate-400 font-medium cursor-pointer hover:text-white"
                                    onClick={() => handleSort('trade_date')}
                                >
                                    <div className="flex items-center gap-1">
                                        Date <SortIndicator column="trade_date" />
                                    </div>
                                </th>
                                <th
                                    className="text-left py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                                    onClick={() => handleSort('trade_time')}
                                >
                                    <div className="flex items-center gap-1">
                                        Time <SortIndicator column="trade_time" />
                                    </div>
                                </th>
                                <th
                                    className="text-left py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                                    onClick={() => handleSort('broker_code')}
                                >
                                    <div className="flex items-center gap-1">
                                        Broker <SortIndicator column="broker_code" />
                                    </div>
                                </th>
                                <th
                                    className="text-right py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                                    onClick={() => handleSort('qty')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Lot <SortIndicator column="qty" />
                                    </div>
                                </th>
                                <th
                                    className="text-right py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                                    onClick={() => handleSort('value')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Value <SortIndicator column="value" />
                                    </div>
                                </th>
                                <th
                                    className="text-center py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                                    onClick={() => handleSort('direction')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        Dir <SortIndicator column="direction" />
                                    </div>
                                </th>
                                <th className="text-left py-2 px-2 text-slate-400 font-medium">Counter</th>
                                <th
                                    className="text-center py-2 px-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                                    onClick={() => handleSort('level')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        Level <SortIndicator column="level" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedTrades.slice(0, 500).map((trade, i) => {
                                const isTopTrade = top5Values.has(trade.value);
                                const isStrong = trade.level === 'STRONG';

                                return (
                                    <tr
                                        key={i}
                                        className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${isTopTrade ? 'bg-red-500/10 shadow-[inset_0_0_20px_rgba(239,68,68,0.15)]' :
                                                isStrong ? 'bg-orange-500/5' : ''
                                            }`}
                                    >
                                        <td className="py-2 px-3 text-slate-500 font-mono">
                                            {trade.trade_date?.slice(-5) || '-'}
                                        </td>
                                        <td className="py-2 px-2 text-slate-400 font-mono">
                                            {trade.trade_time}
                                        </td>
                                        <td className="py-2 px-2">
                                            <button
                                                onClick={() => onBrokerClick?.(trade.broker_code)}
                                                className={`font-bold hover:underline ${trade.direction === 'BUY' ? 'text-green-400' : 'text-red-400'
                                                    }`}
                                            >
                                                {trade.broker_code}
                                                {isTopTrade && <Zap className="w-3 h-3 inline ml-1 text-yellow-400" />}
                                            </button>
                                            <div className="text-[9px] text-slate-600">{trade.broker_name}</div>
                                        </td>
                                        <td className="py-2 px-2 text-right text-white font-mono font-bold">
                                            {(trade.qty || 0).toLocaleString()}
                                        </td>
                                        <td className={`py-2 px-2 text-right font-mono font-bold ${isTopTrade ? 'text-yellow-400' : 'text-teal-400'
                                            }`}>
                                            {formatRupiah(trade.value)}
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.direction === 'BUY'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {trade.direction}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-slate-400">
                                            <span className="font-mono">{trade.counterparty}</span>
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.level === 'STRONG'
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                                }`}>
                                                {trade.level}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {displayedTrades.length > 500 && (
                        <div className="text-center py-2 text-xs text-slate-500">
                            Showing first 500 of {displayedTrades.length} filtered trades
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
