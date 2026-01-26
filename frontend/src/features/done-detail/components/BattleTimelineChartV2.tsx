'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
    ComposedChart,
    Area,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Brush,
    ReferenceLine,
    ReferenceArea
} from 'recharts';
import { BattleTimelineDay, RangeSummary } from '@/services/api/doneDetail';

// ===== TYPES =====
interface BattleTimelineChartV2Props {
    data: BattleTimelineDay[];
    summary?: RangeSummary;
    height?: number;
}

interface ChartDataPoint {
    date: string;
    fullDate: string;
    total: number;
    tradeCount: number;
    dayOverDayChange: number;
    movingAvg: number;
    isPeak: boolean;
    intensity: 'HIGH' | 'MEDIUM' | 'LOW';
    [broker: string]: string | number | boolean;
}

type BattleTooltipPayload = {
    payload: ChartDataPoint;
};

type BattleTooltipProps = {
    active?: boolean;
    payload?: BattleTooltipPayload[];
    label?: string;
};

// ===== CONSTANTS =====
const BROKER_COLORS = [
    '#f97316', '#3b82f6', '#22c55e', '#eab308', '#ec4899',
    '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1', '#84cc16',
    '#06b6d4', '#d946ef', '#f59e0b', '#10b981', '#6b7280'
];

const INTENSITY_COLORS = {
    HIGH: 'rgba(239, 68, 68, 0.08)',
    MEDIUM: 'rgba(234, 179, 8, 0.05)',
    LOW: 'rgba(34, 197, 94, 0.03)'
};

// ===== UTILITIES =====
const formatValue = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
};

const calculateMovingAverage = (data: number[], window: number): number[] => {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < window - 1) {
            result.push(data[i]);
        } else {
            const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / window);
        }
    }
    return result;
};

const getIntensityLevel = (value: number, maxValue: number): 'HIGH' | 'MEDIUM' | 'LOW' => {
    const ratio = value / maxValue;
    if (ratio >= 0.7) return 'HIGH';
    if (ratio >= 0.4) return 'MEDIUM';
    return 'LOW';
};

const detectPattern = (data: number[]): { pattern: string; direction: 'UP' | 'DOWN' | 'FLAT'; strength: number } => {
    if (data.length < 3) return { pattern: 'INSUFFICIENT_DATA', direction: 'FLAT', strength: 0 };

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 20) return { pattern: 'ESCALATING', direction: 'UP', strength: Math.min(change, 100) };
    if (change < -20) return { pattern: 'DE_ESCALATING', direction: 'DOWN', strength: Math.min(Math.abs(change), 100) };
    return { pattern: 'STABLE', direction: 'FLAT', strength: Math.abs(change) };
};

// ===== CUSTOM TOOLTIP =====
const CustomTooltip = ({ active, payload }: BattleTooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload as ChartDataPoint;
    if (!data) return null;

    // Get broker values from payload (excluding non-broker fields)
    const brokerEntries = Object.entries(data)
        .filter(([key]) => !['date', 'fullDate', 'total', 'tradeCount', 'dayOverDayChange', 'movingAvg', 'isPeak', 'intensity'].includes(key))
        .filter(([, value]) => typeof value === 'number' && value > 0)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);

    return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs max-w-xs">
            <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-slate-400">{data.fullDate || 'N/A'}</span>
                {data.isPeak && <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded">PEAK</span>}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                    <p className="text-slate-500 text-[10px]">Total Imposter</p>
                    <p className="font-bold text-orange-400">{formatValue((data.total ?? 0) * 1e6)}</p>
                </div>
                <div>
                    <p className="text-slate-500 text-[10px]">Trade Count</p>
                    <p className="font-bold text-blue-400">{(data.tradeCount ?? 0).toLocaleString()}</p>
                </div>
            </div>

            {data.dayOverDayChange != null && data.dayOverDayChange !== 0 && (
                <div className="mb-2">
                    <span className="text-slate-500 text-[10px]">vs Previous: </span>
                    <span className={`font-bold ${data.dayOverDayChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {data.dayOverDayChange > 0 ? '+' : ''}{data.dayOverDayChange.toFixed(1)}%
                    </span>
                </div>
            )}

            {brokerEntries.length > 0 && (
                <div className="border-t border-slate-700 pt-2 mt-2">
                    <p className="text-[10px] text-slate-500 mb-1">Top Contributors:</p>
                    {brokerEntries.map(([broker, value], idx) => (
                        <div key={broker} className="flex justify-between text-[10px]">
                            <span className="text-slate-400 flex items-center gap-1">
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: BROKER_COLORS[idx % BROKER_COLORS.length] }}
                                />
                                {broker}
                            </span>
                            <span className="text-orange-400">{formatValue((value as number) * 1e6)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ===== MAIN COMPONENT =====
export const BattleTimelineChartV2: React.FC<BattleTimelineChartV2Props> = ({
    data,
    summary,
    height = 350
}) => {
    // State for interactive legend
    const [hiddenBrokers, setHiddenBrokers] = useState<Set<string>>(new Set());

    // Get all unique brokers across all days
    const allBrokers = useMemo(() => {
        const brokerTotals: Record<string, number> = {};
        data.forEach(day => {
            Object.entries(day.broker_breakdown).forEach(([broker, value]) => {
                brokerTotals[broker] = (brokerTotals[broker] || 0) + value;
            });
        });
        // Return top 10 brokers sorted by total value
        return Object.entries(brokerTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([broker]) => broker);
    }, [data]);

    // Transform data for chart
    const chartData = useMemo((): ChartDataPoint[] => {
        const maxValue = Math.max(...data.map(d => d.total_imposter_value));
        const peakDay = summary?.peak_day;
        const values = data.map(d => d.total_imposter_value);
        const movingAvgs = calculateMovingAverage(values, 3);

        return data.map((day, idx) => {
            const prevValue = idx > 0 ? data[idx - 1].total_imposter_value : day.total_imposter_value;
            const dayOverDayChange = prevValue > 0
                ? ((day.total_imposter_value - prevValue) / prevValue) * 100
                : 0;

            const point: ChartDataPoint = {
                date: day.date.slice(-5), // MM-DD format
                fullDate: day.date,
                total: day.total_imposter_value / 1e6,
                tradeCount: day.trade_count,
                dayOverDayChange: idx === 0 ? 0 : dayOverDayChange,
                movingAvg: movingAvgs[idx] / 1e6,
                isPeak: day.date === peakDay,
                intensity: getIntensityLevel(day.total_imposter_value, maxValue)
            };

            // Add broker breakdown values
            allBrokers.forEach(broker => {
                point[broker] = (day.broker_breakdown[broker] || 0) / 1e6;
            });

            return point;
        });
    }, [data, summary, allBrokers]);

    // Pattern detection
    const pattern = useMemo(() => {
        const values = chartData.map(d => d.total);
        return detectPattern(values);
    }, [chartData]);

    // Toggle broker visibility
    const toggleBroker = useCallback((broker: string) => {
        setHiddenBrokers(prev => {
            const next = new Set(prev);
            if (next.has(broker)) {
                next.delete(broker);
            } else {
                next.add(broker);
            }
            return next;
        });
    }, []);

    // Get visible brokers
    const visibleBrokers = useMemo(() =>
        allBrokers.filter(b => !hiddenBrokers.has(b)),
        [allBrokers, hiddenBrokers]);

    // Peak day index for reference line
    const peakIndex = chartData.findIndex(d => d.isPeak);

    // Max values for scaling
    const maxTotal = Math.max(...chartData.map(d => d.total));
    const maxTradeCount = Math.max(...chartData.map(d => d.tradeCount));

    return (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            {/* Header with Pattern Indicator */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-blue-400">⚔️ Battle Timeline</div>
                    <div className={`text-[10px] px-2 py-0.5 rounded ${pattern.direction === 'UP' ? 'bg-green-500/20 text-green-400' :
                        pattern.direction === 'DOWN' ? 'bg-red-500/20 text-red-400' :
                            'bg-slate-500/20 text-slate-400'
                        }`}>
                        {pattern.pattern === 'ESCALATING' && '📈 Escalating'}
                        {pattern.pattern === 'DE_ESCALATING' && '📉 De-escalating'}
                        {pattern.pattern === 'STABLE' && '➡️ Stable'}
                        {pattern.pattern === 'INSUFFICIENT_DATA' && '❓ Limited Data'}
                    </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Imposter Value (M)
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Trade Count
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-4 border-t-2 border-dashed border-yellow-500"></span>
                        Trend (3d MA)
                    </span>
                </div>
            </div>

            {/* Interactive Legend */}
            <div className="flex flex-wrap gap-2 mb-3">
                {allBrokers.map((broker, idx) => (
                    <button
                        key={broker}
                        onClick={() => toggleBroker(broker)}
                        className={`text-[10px] px-2 py-1 rounded border transition-all ${hiddenBrokers.has(broker)
                            ? 'border-slate-700 text-slate-500 bg-slate-800/50'
                            : 'border-slate-600 text-white bg-slate-800'
                            }`}
                        style={{
                            borderColor: hiddenBrokers.has(broker) ? undefined : BROKER_COLORS[idx % BROKER_COLORS.length]
                        }}
                    >
                        <span
                            className="w-2 h-2 rounded-full inline-block mr-1"
                            style={{
                                backgroundColor: hiddenBrokers.has(broker)
                                    ? '#4b5563'
                                    : BROKER_COLORS[idx % BROKER_COLORS.length]
                            }}
                        />
                        {broker}
                    </button>
                ))}
                {allBrokers.length > 0 && (
                    <button
                        onClick={() => setHiddenBrokers(new Set())}
                        className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-400 hover:text-white transition-all"
                    >
                        Show All
                    </button>
                )}
            </div>

            {/* Main Chart */}
            <div style={{ width: '100%', height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 10, right: 50, left: 0, bottom: 30 }}
                    >
                        <defs>
                            {allBrokers.map((broker, idx) => (
                                <linearGradient key={broker} id={`gradient-${broker}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={BROKER_COLORS[idx % BROKER_COLORS.length]} stopOpacity={0.8} />
                                    <stop offset="95%" stopColor={BROKER_COLORS[idx % BROKER_COLORS.length]} stopOpacity={0.2} />
                                </linearGradient>
                            ))}
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />

                        {/* Intensity background zones */}
                        {chartData.map((point, idx) => {
                            if (idx === chartData.length - 1) return null;
                            return (
                                <ReferenceArea
                                    key={`zone-${idx}`}
                                    x1={point.date}
                                    x2={chartData[idx + 1]?.date}
                                    fill={INTENSITY_COLORS[point.intensity]}
                                    fillOpacity={1}
                                />
                            );
                        })}

                        {/* Peak day marker */}
                        {peakIndex >= 0 && (
                            <ReferenceLine
                                x={chartData[peakIndex]?.date}
                                stroke="#ef4444"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: '🔥 PEAK',
                                    position: 'top',
                                    fill: '#ef4444',
                                    fontSize: 10
                                }}
                            />
                        )}

                        <XAxis
                            dataKey="date"
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={{ stroke: '#334155' }}
                            tickLine={{ stroke: '#334155' }}
                        />

                        {/* Primary Y-Axis (Value) */}
                        <YAxis
                            yAxisId="value"
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v.toFixed(0)}M`}
                            width={45}
                            domain={[0, maxTotal * 1.1]}
                        />

                        {/* Secondary Y-Axis (Trade Count) */}
                        <YAxis
                            yAxisId="count"
                            orientation="right"
                            tick={{ fill: '#3b82f6', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => v.toLocaleString()}
                            width={50}
                            domain={[0, maxTradeCount * 1.2]}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        {/* Stacked Areas for brokers */}
                        {visibleBrokers.map((broker) => (
                            <Area
                                key={broker}
                                type="monotone"
                                dataKey={broker}
                                yAxisId="value"
                                stackId="1"
                                stroke={BROKER_COLORS[allBrokers.indexOf(broker) % BROKER_COLORS.length]}
                                fill={`url(#gradient-${broker})`}
                                strokeWidth={1}
                            />
                        ))}

                        {/* Trade count as bars */}
                        <Bar
                            dataKey="tradeCount"
                            yAxisId="count"
                            fill="#3b82f6"
                            opacity={0.3}
                            barSize={8}
                        />

                        {/* Moving average trend line */}
                        <Line
                            type="monotone"
                            dataKey="movingAvg"
                            yAxisId="value"
                            stroke="#eab308"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                        />

                        {/* Brush for zoom/pan */}
                        <Brush
                            dataKey="date"
                            height={25}
                            stroke="#475569"
                            fill="#1e293b"
                            travellerWidth={8}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Day-over-Day Change Indicators */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-[10px] text-slate-500 shrink-0">Daily Δ:</span>
                {chartData.slice(-10).map((point) => (
                    <div
                        key={point.date}
                        className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${point.dayOverDayChange > 10 ? 'bg-green-500/20 text-green-400' :
                            point.dayOverDayChange > 0 ? 'bg-green-500/10 text-green-300' :
                                point.dayOverDayChange < -10 ? 'bg-red-500/20 text-red-400' :
                                    point.dayOverDayChange < 0 ? 'bg-red-500/10 text-red-300' :
                                        'bg-slate-700 text-slate-400'
                            }`}
                    >
                        {point.date}: {point.dayOverDayChange > 0 ? '+' : ''}{point.dayOverDayChange.toFixed(0)}%
                    </div>
                ))}
            </div>
        </div>
    );
};
