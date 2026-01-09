"use client";

import React from 'react';
import {
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
    Bar
} from 'recharts';

interface ChartDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface HybridChartProps {
    data: ChartDataPoint[];
    supports: number[];
    resistances: number[];
    tradePlan?: {
        action: string;
        entry_zone: { low: number; high: number };
        targets: number[];
        stop_loss: number;
    };
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;

        // Don't show tooltip for padded/future points (undefined data)
        if (!data.close || data.close === undefined) {
            return null;
        }

        return (
            <div className="bg-zinc-900/95 border border-zinc-700 p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-zinc-500 text-xs mb-2 font-mono">{label}</p>
                <div className="space-y-1 font-mono text-sm">
                    <p className="flex justify-between gap-6 items-center">
                        <span className="text-zinc-400 text-xs">Close</span>
                        <span className="text-white font-bold">{data.close?.toLocaleString() || 'N/A'}</span>
                    </p>
                    <p className="flex justify-between gap-6 items-center">
                        <span className="text-zinc-400 text-xs">Vol</span>
                        <span className="text-blue-400">{data.volume?.toLocaleString() || '0'}</span>
                    </p>
                    <div className="h-px bg-zinc-800 my-2" />
                    <p className="flex justify-between gap-6 text-xs text-zinc-500">
                        <span>H: {data.high || 'N/A'}</span>
                        <span>L: {data.low || 'N/A'}</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

export const HybridChart: React.FC<HybridChartProps> = ({ data, supports, resistances, tradePlan }) => {
    if (!data || data.length === 0) return <div className="text-zinc-500 flex items-center justify-center h-full">No Chart Data</div>;

    // Add empty data points to the right for future projection space
    const paddingPoints = 15;
    const lastPoint = data[data.length - 1];
    const paddedData = [...data];

    // Simple future dates for padding
    for (let i = 1; i <= paddingPoints; i++) {
        const nextDate = new Date(lastPoint.date);
        nextDate.setDate(nextDate.getDate() + i);
        paddedData.push({
            ...lastPoint,
            date: nextDate.toISOString().split('T')[0],
            close: undefined as any,
            open: undefined as any,
            high: undefined as any,
            low: undefined as any,
            volume: 0
        });
    }

    const minPrice = Math.min(...data.map(d => d.low)) * 0.95;
    const maxPrice = Math.max(...data.map(d => d.high), ...(tradePlan?.targets || [])) * 1.05;

    return (
        <div className="w-full h-full bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <h3 className="text-zinc-300 font-bold mb-4 text-sm flex items-center gap-2 z-10">
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                Price Action & Market Flow
            </h3>

            <div className="flex-1 min-h-0 z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paddedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#52525b"
                            tick={{ fontSize: 10 }}
                            minTickGap={40}
                            tickFormatter={(val) => {
                                const d = new Date(val);
                                return `${d.getDate()}/${d.getMonth() + 1}`;
                            }}
                        />
                        <YAxis
                            yAxisId="price"
                            domain={[minPrice, maxPrice]}
                            orientation="right"
                            stroke="#52525b"
                            tick={{ fontSize: 10, fontFamily: 'monospace' }}
                            tickFormatter={(val) => val.toLocaleString()}
                            width={50}
                        />
                        <YAxis
                            yAxisId="volume"
                            orientation="left"
                            hide
                            domain={[0, (max: number) => max * 5]} // Volume bars take bottom 20% for more space
                        />

                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeDasharray: '3 3' }} />

                        {/* Trade Plan Overlays */}
                        {tradePlan && (
                            <>
                                {/* Projection Lines (Phase B) */}
                                {data.length > 0 && (
                                    <>
                                        {/* Success Path */}
                                        <ReferenceLine
                                            yAxisId="price"
                                            segment={[
                                                { x: data[data.length - 1].date, y: data[data.length - 1].close },
                                                { x: 'PROJECTION_END', y: tradePlan.targets[0] }
                                            ]}
                                            stroke="#3b82f6"
                                            strokeDasharray="3 3"
                                            strokeOpacity={0.4}
                                        />
                                        {/* Failure Path */}
                                        <ReferenceLine
                                            yAxisId="price"
                                            segment={[
                                                { x: data[data.length - 1].date, y: data[data.length - 1].close },
                                                { x: 'PROJECTION_END', y: tradePlan.stop_loss }
                                            ]}
                                            stroke="#ef4444"
                                            strokeDasharray="3 3"
                                            strokeOpacity={0.4}
                                        />
                                    </>
                                )}

                                {/* Entry Zone */}
                                <ReferenceArea
                                    yAxisId="price"
                                    y1={tradePlan.entry_zone.low}
                                    y2={tradePlan.entry_zone.high}
                                    fill="#10b981"
                                    fillOpacity={0.12} // Increased for clarity
                                    stroke="#10b981"
                                    strokeOpacity={0.3}
                                    strokeDasharray="3 3"
                                />

                                {/* Targets */}
                                {tradePlan.targets.map((target, i) => (
                                    <ReferenceLine
                                        key={`tp-${i}`}
                                        yAxisId="price"
                                        y={target}
                                        stroke="#3b82f6"
                                        strokeWidth={1}
                                        strokeDasharray="5 5"
                                        label={{
                                            value: `TP${i + 1}: ${target.toLocaleString()}`,
                                            position: 'insideRight',
                                            fill: '#3b82f6',
                                            fontSize: 10,
                                            fontWeight: 'bold',
                                            offset: 10
                                        }}
                                    />
                                ))}

                                {/* Stop Loss */}
                                <ReferenceLine
                                    yAxisId="price"
                                    y={tradePlan.stop_loss}
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    label={{
                                        value: `SL: ${tradePlan.stop_loss.toLocaleString()}`,
                                        position: 'insideRight',
                                        fill: '#ef4444',
                                        fontSize: 10,
                                        fontWeight: 'bold',
                                        offset: 10
                                    }}
                                />
                            </>
                        )}

                        {/* Support Lines (Green) */}
                        {supports.map((level, idx) => (
                            <ReferenceLine
                                key={`sup-${idx}`}
                                yAxisId="price"
                                y={level}
                                stroke="#10b981"
                                strokeDasharray="2 2"
                                strokeOpacity={0.6}
                                label={{
                                    value: `S${idx + 1}`,
                                    position: 'insideLeft',
                                    fill: '#10b981',
                                    fontSize: 9,
                                    opacity: 0.8
                                }}
                            />
                        ))}

                        {/* Resistance Lines (Red) */}
                        {resistances.map((level, idx) => (
                            <ReferenceLine
                                key={`res-${idx}`}
                                yAxisId="price"
                                y={level}
                                stroke="#ef4444"
                                strokeDasharray="2 2"
                                strokeOpacity={0.6}
                                label={{
                                    value: `R${idx + 1}`,
                                    position: 'insideLeft',
                                    fill: '#ef4444',
                                    fontSize: 9,
                                    opacity: 0.8
                                }}
                            />
                        ))}

                        {/* Volume Bars */}
                        <Bar
                            yAxisId="volume"
                            dataKey="volume"
                            fill="#3b82f6"
                            fillOpacity={0.35} // More solid than previous gradient for clarity
                            radius={[2, 2, 0, 0]}
                        />

                        {/* Main Price Area */}
                        <Area
                            yAxisId="price"
                            type="monotone"
                            dataKey="close"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                            connectNulls={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
