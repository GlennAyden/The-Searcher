'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Flame, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { UnusualVolumeEvent } from '@/services/api/priceVolume';

interface UnusualVolumeListProps {
    data: UnusualVolumeEvent[];
    isLoading: boolean;
    onTickerClick: (ticker: string) => void;
}

interface GroupedTicker {
    ticker: string;
    events: UnusualVolumeEvent[];
    maxRatio: number;
    maxCategory: string;
    totalEvents: number;
    latestDate: string;
}

const formatVolume = (volume: number): string => {
    if (volume >= 1_000_000_000) {
        return `${(volume / 1_000_000_000).toFixed(1)}B`;
    }
    if (volume >= 1_000_000) {
        return `${(volume / 1_000_000).toFixed(1)}M`;
    }
    if (volume >= 1_000) {
        return `${(volume / 1_000).toFixed(1)}K`;
    }
    return volume.toString();
};

const getCategoryConfig = (category: string) => {
    switch (category) {
        case 'extreme':
            return {
                icon: Flame,
                bgColor: 'bg-red-500/20',
                textColor: 'text-red-400',
                borderColor: 'border-red-500/30',
                label: 'Extreme'
            };
        case 'high':
            return {
                icon: Zap,
                bgColor: 'bg-orange-500/20',
                textColor: 'text-orange-400',
                borderColor: 'border-orange-500/30',
                label: 'High'
            };
        default: // elevated
            return {
                icon: AlertTriangle,
                bgColor: 'bg-yellow-500/20',
                textColor: 'text-yellow-400',
                borderColor: 'border-yellow-500/30',
                label: 'Elevated'
            };
    }
};

export const UnusualVolumeList: React.FC<UnusualVolumeListProps> = ({
    data,
    isLoading,
    onTickerClick
}) => {
    const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());

    // Group events by ticker
    const groupedData = useMemo(() => {
        const groups: Record<string, GroupedTicker> = {};

        data.forEach(event => {
            if (!groups[event.ticker]) {
                groups[event.ticker] = {
                    ticker: event.ticker,
                    events: [],
                    maxRatio: 0,
                    maxCategory: 'elevated',
                    totalEvents: 0,
                    latestDate: event.date
                };
            }
            groups[event.ticker].events.push(event);
            groups[event.ticker].totalEvents++;

            if (event.ratio > groups[event.ticker].maxRatio) {
                groups[event.ticker].maxRatio = event.ratio;
                groups[event.ticker].maxCategory = event.category;
            }

            // Track latest date for sorting
            if (event.date > groups[event.ticker].latestDate) {
                groups[event.ticker].latestDate = event.date;
            }
        });

        // Sort events within each group by date descending (newest first)
        Object.values(groups).forEach(group => {
            group.events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });

        // Sort groups by latest date descending (newest first)
        return Object.values(groups).sort((a, b) =>
            new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
        );
    }, [data]);

    const toggleTicker = (ticker: string) => {
        setExpandedTickers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ticker)) {
                newSet.delete(ticker);
            } else {
                newSet.add(ticker);
            }
            return newSet;
        });
    };

    if (isLoading) {
        return (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center justify-center py-4">
                    <div className="animate-pulse text-zinc-500">Scanning for unusual volumes...</div>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="text-center py-4">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p className="text-zinc-500">No unusual volume events detected in the past 30 days</p>
                    <p className="text-xs text-zinc-600 mt-1">Search for tickers to add them to the scanner</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-zinc-100">Unusual Volume Alerts</h3>
                    <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                        {groupedData.length} tickers • {data.length} events
                    </span>
                </div>
                <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <span className="text-zinc-500">2-3x</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                        <span className="text-zinc-500">3-5x</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <span className="text-zinc-500">&gt;5x</span>
                    </div>
                </div>
            </div>

            {/* Grouped List */}
            <div className="divide-y divide-zinc-800/50">
                {groupedData.map((group) => {
                    const config = getCategoryConfig(group.maxCategory);
                    const Icon = config.icon;
                    const isExpanded = expandedTickers.has(group.ticker);

                    return (
                        <div key={group.ticker}>
                            {/* Ticker Header Row - Clickable to expand */}
                            <div
                                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                                onClick={() => toggleTicker(group.ticker)}
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                                    )}
                                    <span className="font-bold text-zinc-100 text-lg">{group.ticker}</span>
                                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                                        {group.totalEvents} event{group.totalEvents > 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`font-bold ${config.textColor}`}>
                                        Max: {group.maxRatio.toFixed(1)}x
                                    </span>
                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${config.bgColor} ${config.textColor} ${config.borderColor} border`}>
                                        <Icon className="w-3 h-3" />
                                        {config.label}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTickerClick(group.ticker);
                                        }}
                                        className="px-3 py-1 text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded-lg hover:bg-emerald-600/30 transition-colors"
                                    >
                                        View Chart
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Detail Table */}
                            {isExpanded && (
                                <div className="bg-zinc-950/50 border-t border-zinc-800/50">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800/50">
                                                <th className="px-6 py-2">Date</th>
                                                <th className="px-4 py-2 text-right">Volume</th>
                                                <th className="px-4 py-2 text-right">Median 20D</th>
                                                <th className="px-4 py-2 text-right">Ratio</th>
                                                <th className="px-4 py-2 text-right">Price</th>
                                                <th className="px-4 py-2 text-right">Change</th>
                                                <th className="px-4 py-2">Category</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.events.map((event, index) => {
                                                const eventConfig = getCategoryConfig(event.category);
                                                const EventIcon = eventConfig.icon;
                                                const isPositive = event.price_change >= 0;

                                                return (
                                                    <tr
                                                        key={`${event.ticker}-${event.date}-${index}`}
                                                        className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                                                    >
                                                        <td className="px-6 py-2 text-zinc-400">
                                                            {new Date(event.date).toLocaleDateString('id-ID', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-mono text-zinc-100">
                                                            {formatVolume(event.volume)}
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-mono text-zinc-500">
                                                            {formatVolume(event.median_20d)}
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            <span className={`font-bold ${eventConfig.textColor}`}>
                                                                {event.ratio.toFixed(1)}x
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-mono text-zinc-100">
                                                            {event.close.toLocaleString('id-ID')}
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'
                                                                }`}>
                                                                {isPositive ? (
                                                                    <TrendingUp className="w-3 h-3" />
                                                                ) : (
                                                                    <TrendingDown className="w-3 h-3" />
                                                                )}
                                                                <span className="font-medium text-xs">
                                                                    {isPositive ? '+' : ''}{event.price_change.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${eventConfig.bgColor} ${eventConfig.textColor} ${eventConfig.borderColor} border`}>
                                                                <EventIcon className="w-3 h-3" />
                                                                {eventConfig.label}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
