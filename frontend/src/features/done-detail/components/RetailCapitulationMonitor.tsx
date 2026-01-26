'use client';

import React from 'react';
import { RetailCapitulationBroker } from '@/services/api/doneDetail';

interface RetailCapitulationMonitorProps {
    brokers: RetailCapitulationBroker[];
    overallPct: number;
    safeCount: number;
    holdingCount: number;
}

const formatValue = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
};

export const RetailCapitulationMonitor: React.FC<RetailCapitulationMonitorProps> = ({
    brokers,
    overallPct,
    safeCount,
    holdingCount
}) => {
    // Guard against undefined props
    const safeBrokers = brokers || [];
    const safeOverallPct = overallPct ?? 0;
    const safeSafeCount = safeCount ?? 0;
    const safeHoldingCount = holdingCount ?? 0;

    return (
        <div className="space-y-4">
            {/* Overall Status Gauge */}
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-orange-400">📊 Retail Capitulation Index</div>
                    <div className="text-xs text-slate-500">50% Rule Monitor</div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div
                        className={`absolute inset-y-0 left-0 transition-all duration-500 ${safeOverallPct >= 50 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'
                            }`}
                        style={{ width: `${Math.min(100, safeOverallPct)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white font-black text-sm drop-shadow-lg">
                            {safeOverallPct.toFixed(1)}%
                        </span>
                    </div>
                    {/* 50% marker */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50" />
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-emerald-400">{safeSafeCount}</div>
                        <div className="text-[10px] text-emerald-400/70 font-bold uppercase">✅ Safe (≥50%)</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-amber-400">{safeHoldingCount}</div>
                        <div className="text-[10px] text-amber-400/70 font-bold uppercase">⚠️ Still Holding</div>
                    </div>
                </div>
            </div>

            {/* Broker Progress Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {safeBrokers.slice(0, 9).map((broker) => {
                    const distributionPct = broker.distribution_pct ?? 0;
                    const isSafe = broker.is_safe ?? false;

                    return (
                        <div
                            key={broker.broker}
                            className={`bg-slate-900/50 border rounded-xl p-3 transition-all hover:scale-[1.02] ${isSafe
                                ? 'border-emerald-500/30 hover:border-emerald-500/50'
                                : 'border-amber-500/30 hover:border-amber-500/50'
                                }`}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg font-black ${isSafe ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {broker.broker}
                                    </span>
                                    <span className="text-[10px] text-slate-500 truncate max-w-[100px]">
                                        {broker.name}
                                    </span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isSafe
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                    }`}>
                                    {isSafe ? '✅ SAFE' : '⚠️ HOLD'}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
                                <div
                                    className={`absolute inset-y-0 left-0 transition-all ${isSafe ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`}
                                    style={{ width: `${Math.min(100, Math.max(0, distributionPct))}%` }}
                                />
                                {/* 50% marker */}
                                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30" />
                            </div>

                            {/* Stats */}
                            <div className="flex items-center justify-between text-[10px]">
                                <div className="text-slate-500">
                                    <span className="font-bold">{distributionPct.toFixed(1)}%</span> Distributed
                                </div>
                                <div className="text-slate-600">
                                    Peak: <span className="text-slate-400">{formatValue(broker.peak_position)}</span>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-600 mt-1">
                                Now: <span className="text-slate-400">{formatValue(broker.current_position)}</span>
                                {distributionPct < 50 && (
                                    <span className="text-amber-400/70 ml-2">
                                        Need {(50 - distributionPct).toFixed(1)}% more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
