'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface NetVolumeChartProps {
    data: { time: string; netVol: number }[];
}

export function NetVolumeChart({ data }: NetVolumeChartProps) {
    // If no data, show placeholder
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-600">
                <p className="text-sm">No volume data yet</p>
            </div>
        );
    }

    // Determine trend color
    const lastVal = data[data.length - 1].netVol;
    const isPositive = lastVal >= 0;
    const color = isPositive ? '#4ade80' : '#f87171';
    const gradientId = isPositive ? 'colorGreen' : 'colorRed';

    return (
        <div className="w-full h-full p-2">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        hide={true}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', fontSize: '12px' }}
                        itemStyle={{ color: '#fff' }}
                    />
                    <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
                    <Area
                        type="monotone"
                        dataKey="netVol"
                        stroke={color}
                        fillOpacity={1}
                        fill={`url(#${gradientId})`}
                        animationDuration={500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
