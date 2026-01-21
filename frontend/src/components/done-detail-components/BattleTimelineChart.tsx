'use client';

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { BattleTimelineDay } from '@/services/api/doneDetail';

interface BattleTimelineChartProps {
    data: BattleTimelineDay[];
    height?: number;
}

const formatValue = (value: number): string => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload as BattleTimelineDay;
        const topBrokers = Object.entries(data.broker_breakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
                <p className="font-mono text-slate-400 mb-2">{label}</p>
                <p className="font-bold text-orange-400 text-sm mb-2">
                    {formatValue(data.total_imposter_value)} Total Imposter
                </p>
                <p className="text-slate-500 mb-2">{data.trade_count} trades</p>

                {topBrokers.length > 0 && (
                    <div className="border-t border-slate-700 pt-2">
                        <p className="text-[10px] text-slate-500 mb-1">Top Contributors:</p>
                        {topBrokers.map(([broker, value]) => (
                            <div key={broker} className="flex justify-between text-[10px]">
                                <span className="text-slate-400">{broker}</span>
                                <span className="text-orange-400">{formatValue(value)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export const BattleTimelineChart: React.FC<BattleTimelineChartProps> = ({
    data,
    height = 250
}) => {
    // Transform data for chart
    const chartData = data.map(d => ({
        ...d,
        date: d.date.slice(-5), // MM-DD format
        value: d.total_imposter_value / 1e6 // Convert to millions for display
    }));

    return (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-blue-400">⚔️ Battle Timeline</div>
                <div className="text-[10px] text-slate-500">Daily Imposter Activity (Million Rp)</div>
            </div>

            <div style={{ width: '100%', height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorImposter" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={{ stroke: '#334155' }}
                        />
                        <YAxis
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v.toFixed(0)}M`}
                            width={45}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#f97316"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorImposter)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
