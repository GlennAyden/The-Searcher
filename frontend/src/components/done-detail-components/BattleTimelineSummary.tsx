'use client';

import React, { useMemo } from 'react';
import { RangeSummary, BattleTimelineDay } from '@/services/api/doneDetail';

interface BattleTimelineSummaryProps {
    summary: RangeSummary;
    timeline: BattleTimelineDay[];
}

const formatValue = (value: number): string => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
};

export const BattleTimelineSummary: React.FC<BattleTimelineSummaryProps> = ({ summary, timeline }) => {
    // Calculate additional statistics
    const stats = useMemo(() => {
        if (!timeline || timeline.length === 0) {
            return {
                totalValue: 0,
                avgDaily: 0,
                activeDays: 0,
                trend: 'STABLE' as const,
                trendPct: 0
            };
        }

        const values = timeline.map(d => d.total_imposter_value);
        const totalValue = values.reduce((a, b) => a + b, 0);
        const avgDaily = totalValue / timeline.length;
        const activeDays = values.filter(v => v > 0).length;

        // Calculate trend (compare first half vs second half)
        const midpoint = Math.floor(values.length / 2);
        const firstHalf = values.slice(0, midpoint);
        const secondHalf = values.slice(midpoint);

        const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
        const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;

        const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

        let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
        if (trendPct > 15) trend = 'UP';
        else if (trendPct < -15) trend = 'DOWN';

        return { totalValue, avgDaily, activeDays, trend, trendPct };
    }, [timeline]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {/* Total Value */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Total Imposter</div>
                <div className="text-lg font-bold text-orange-400">{formatValue(stats.totalValue)}</div>
                <div className="text-[10px] text-slate-500">{summary.total_days} days</div>
            </div>

            {/* Peak Day */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Peak Day</div>
                <div className="text-lg font-bold text-red-400">
                    {summary.peak_day ? summary.peak_day.slice(-5) : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500">{formatValue(summary.peak_value)}</div>
            </div>

            {/* Average Daily */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Avg Daily</div>
                <div className="text-lg font-bold text-blue-400">{formatValue(stats.avgDaily)}</div>
                <div className="text-[10px] text-slate-500">{stats.activeDays} active days</div>
            </div>

            {/* Top Ghost */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Top Ghost</div>
                <div className="text-lg font-bold text-purple-400">
                    {summary.top_ghost_broker || 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                    {summary.top_ghost_name || '-'}
                </div>
            </div>

            {/* Trend */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Trend</div>
                <div className={`text-lg font-bold ${stats.trend === 'UP' ? 'text-green-400' :
                        stats.trend === 'DOWN' ? 'text-red-400' :
                            'text-slate-400'
                    }`}>
                    {stats.trend === 'UP' && '📈 Escalating'}
                    {stats.trend === 'DOWN' && '📉 Declining'}
                    {stats.trend === 'STABLE' && '➡️ Stable'}
                </div>
                <div className={`text-[10px] ${stats.trendPct > 0 ? 'text-green-500' :
                        stats.trendPct < 0 ? 'text-red-500' :
                            'text-slate-500'
                    }`}>
                    {stats.trendPct > 0 ? '+' : ''}{stats.trendPct.toFixed(0)}% momentum
                </div>
            </div>
        </div>
    );
};
