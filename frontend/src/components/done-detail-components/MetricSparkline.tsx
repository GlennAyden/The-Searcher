'use client';

import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface MetricSparklineProps {
    data: any[];
    dataKey: string;
    color?: string; // Hex color
    height?: number;
    showGradient?: boolean;
}

export function MetricSparkline({ data, dataKey, color = '#14b8a6', height = 40, showGradient = true }: MetricSparklineProps) {
    if (!data || data.length === 0) return null;

    const id = `gradient-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div style={{ height: height, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Tooltip
                        content={() => null}
                        cursor={{ stroke: '#ffffff20' }}
                    />
                    <Area
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={2}
                        fill={showGradient ? `url(#${id})` : 'transparent'}
                        animationDuration={1000}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
