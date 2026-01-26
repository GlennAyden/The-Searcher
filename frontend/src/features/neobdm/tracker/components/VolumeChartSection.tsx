'use client';

import React from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { VolumeChartPoint } from '../types';

type VolumeChartSectionProps = {
    volumeData: VolumeChartPoint[];
    volumeLoading: boolean;
    volumeError: string | null;
};

type VolumeTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload: VolumeChartPoint }>;
};

function VolumeTooltip({ active, payload }: VolumeTooltipProps) {
    if (active && payload && payload.length) {
        const item = payload[0].payload;
        return (
            <div className="bg-[#181a1f] border border-zinc-700 p-3 rounded-md shadow-xl font-mono text-[10px] min-w-[200px]">
                <p className="text-zinc-400 mb-1 border-b border-zinc-800 pb-1">{item.fullDate}</p>
                <div className="space-y-1 mt-2">
                    <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Volume:</span>
                        <span className="text-purple-400 font-bold">{item.volume.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Close:</span>
                        <span className="text-zinc-300 font-bold">{item.close_price?.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
}

export function VolumeChartSection({ volumeData, volumeLoading, volumeError }: VolumeChartSectionProps) {
    return (
        <div className="bg-[#181a1f] border border-zinc-800/50 rounded-md p-4 h-[350px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-500" />
                    <h3 className="text-xs font-bold text-zinc-400">Daily Trading Volume</h3>
                </div>
                <div className="text-[9px] text-zinc-500 italic">
                    From 22 Dec 2025 â€¢ {volumeData.length} trading days
                </div>
            </div>

            {volumeLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Activity className="w-8 h-8 text-purple-500 animate-pulse" />
                    <span className="text-[10px] text-purple-400 font-bold tracking-[0.2em]">LOADING VOLUME...</span>
                </div>
            ) : volumeError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-red-500">
                    <AlertCircle className="w-8 h-8 opacity-50" />
                    <span className="text-[10px] font-bold">{volumeError}</span>
                </div>
            ) : (
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={volumeData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                                stroke="#52525b"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                            />
                            <Tooltip
                                content={<VolumeTooltip />}
                                cursor={{ fill: '#3f3f46', fillOpacity: 0.3 }}
                            />
                            <Bar dataKey="volume" fill="#a855f7" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
