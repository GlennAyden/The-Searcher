'use client';

import React from 'react';
import { Activity, AlertCircle, TrendingUp } from 'lucide-react';
import {
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { cn } from '@/lib/utils';
import type { ChartRow } from '../types';

type FlowChartSectionProps = {
    flowMetric: string;
    chartData: ChartRow[];
    loading: boolean;
    error: string | null;
};

type FlowDotProps = {
    cx?: number;
    cy?: number;
    payload?: ChartRow;
};

type FlowTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload: ChartRow }>;
    flowMetric: string;
};

const METRIC_LABELS: Record<string, string> = {
    flow_d0: 'Money Flow (D-0)',
    flow_w1: 'Money Flow (W-1)',
    flow_c3: 'Money Flow (3D)',
    flow_c5: 'Money Flow (5D)',
    flow_c10: 'Money Flow (10D)',
    flow_c20: 'Money Flow (20D)',
    flow: 'Money Flow'
};

const getMetricLabel = (metric: string) => METRIC_LABELS[metric] || 'Money Flow';

const parseMarkerValue = (value: unknown) => {
    if (!value || typeof value !== 'string') return null;
    if (value.includes('|')) return value.split('|')[1];
    if (value.toLowerCase() === 'v') return null;
    return value;
};

function FlowTooltip({ active, payload, flowMetric }: FlowTooltipProps) {
    if (active && payload && payload.length) {
        const item = payload[0].payload;

        const crossingMeta = parseMarkerValue(item.crossingVal);
        const unusualMeta = parseMarkerValue(item.unusualVal);
        const pinkyMeta = parseMarkerValue(item.pinkyVal);

        return (
            <div className="bg-[#181a1f] border border-zinc-700 p-3 rounded-md shadow-xl font-mono text-[10px] min-w-[200px] z-50">
                <p className="text-zinc-400 mb-1 border-b border-zinc-800 pb-1">{item.fullDate}</p>
                <div className="space-y-1 mt-2">
                    <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Price:</span>
                        <span className="text-blue-400 font-bold">{item.price?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">{getMetricLabel(flowMetric)}:</span>
                        <span className={cn('font-bold', (item.activeFlow ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {item.activeFlow?.toLocaleString()} <span className="text-[8px] text-zinc-500">B</span>
                        </span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Chg%:</span>
                        <span className={cn('font-bold', (item.pct_change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {item.pct_change?.toFixed(2)}%
                        </span>
                    </div>
                    {(item.isCrossing || item.isUnusual || item.isPinky) && (
                        <div className="mt-2 pt-2 border-t border-zinc-800 flex flex-col gap-1">
                            {item.isCrossing && (
                                <div className="flex justify-between items-center bg-pink-500/10 p-1 rounded-sm">
                                    <span className="bg-pink-500/20 text-pink-400 px-1 rounded-sm text-[8px] font-bold">CROSSING</span>
                                    {crossingMeta && <span className="text-pink-300 font-bold">{crossingMeta}</span>}
                                </div>
                            )}
                            {item.isUnusual && (
                                <div className="flex justify-between items-center bg-orange-500/10 p-1 rounded-sm">
                                    <span className="bg-orange-500/20 text-orange-400 px-1 rounded-sm text-[8px] font-bold">UNUSUAL</span>
                                    {unusualMeta && <span className="text-orange-300 font-bold">{unusualMeta}</span>}
                                </div>
                            )}
                            {item.isPinky && (
                                <div className="flex justify-between items-center bg-red-500/10 p-1 rounded-sm border border-red-500/20">
                                    <div className="flex items-center gap-1">
                                        <span className="bg-red-500/20 text-red-500 px-1 rounded-sm text-[8px] font-bold underline decoration-red-500/50">REPO RISK</span>
                                        <span className="text-[8px] text-red-400 font-bold animate-pulse">!</span>
                                    </div>
                                    {pinkyMeta && <span className="text-red-300 font-bold">{pinkyMeta}</span>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
}

export function FlowChartSection({ flowMetric, chartData, loading, error }: FlowChartSectionProps) {

    return (
        <div className="bg-[#181a1f] border border-zinc-800/50 rounded-md p-4 h-[500px] flex flex-col relative w-full">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-bold text-zinc-400">Price vs {getMetricLabel(flowMetric)} Correlation</h3>
                </div>
                <div className="flex gap-4 text-[9px] font-bold">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" /> PRICE</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500/30 border border-emerald-500/50 rounded-sm" /> POSITIVE FLOW (B)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500/30 border border-red-500/50 rounded-sm" /> NEGATIVE FLOW (B)</div>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
                    <span className="text-[10px] text-blue-400 font-bold tracking-[0.2em]">FETCHING HISTORY...</span>
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-red-500">
                    <AlertCircle className="w-8 h-8 opacity-50" />
                    <span className="text-[10px] font-bold">{error}</span>
                </div>
            ) : (
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <defs>
                                <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#52525b"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                yAxisId="left"
                                stroke="#52525b"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => value.toLocaleString()}
                                domain={['auto', 'auto']}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="#52525b"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => value.toLocaleString() + 'B'}
                            />
                            <Tooltip content={<FlowTooltip flowMetric={flowMetric} />} cursor={{ stroke: '#3f3f46', strokeWidth: 1 }} />

                            <Bar yAxisId="right" dataKey="activeFlow">
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={(entry.activeFlow ?? 0) >= 0 ? '#10b981' : '#ef4444'}
                                        fillOpacity={0.3}
                                        stroke={(entry.activeFlow ?? 0) >= 0 ? '#10b981' : '#ef4444'}
                                        strokeWidth={1}
                                        strokeOpacity={0.5}
                                    />
                                ))}
                            </Bar>

                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="price"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={(props: FlowDotProps) => {
                                    const { cx, cy, payload } = props;
                                    if (!payload || cx === undefined || cy === undefined) {
                                        return null;
                                    }
                                    const hasMarker = payload.isCrossing || payload.isUnusual || payload.isPinky;
                                    if (hasMarker) {
                                        return (
                                            <circle
                                                key={`marker-${payload.scraped_at}`}
                                                cx={cx}
                                                cy={cy}
                                                r={6}
                                                fill="#ec4899"
                                                strokeWidth={2}
                                                stroke="#fff"
                                                className="animate-pulse cursor-help"
                                            />
                                        );
                                    }
                                    return <circle key={`dot-${payload.scraped_at}`} cx={cx} cy={cy} r={2} fill="#3b82f6" stroke="none" />;
                                }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
