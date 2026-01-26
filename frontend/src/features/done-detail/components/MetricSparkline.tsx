'use client';

import React, { useId } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface MetricSparklineProps {
    data: any[];
    dataKey: string;
    color?: string; // Hex color
    height?: number;
    showGradient?: boolean;
}

export function MetricSparkline({ data, dataKey, color = '#14b8a6', height = 40, showGradient = true }: MetricSparklineProps) {
    const gradientId = useId().replace(/:/g, '');
    const id = `gradient-${gradientId}`;
    if (!data || data.length === 0) return null;

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
