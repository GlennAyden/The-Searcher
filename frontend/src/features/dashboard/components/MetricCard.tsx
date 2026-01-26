'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

type MetricCardProps = {
    title: string;
    value: string;
    delta: string;
    icon: React.ComponentType<{ className?: string }>;
    trend: 'up' | 'down' | 'neutral';
    sparklineData?: number[];
    tooltip?: string;
};

export function MetricCard({ title, value, delta, icon: Icon, trend, sparklineData, tooltip }: MetricCardProps) {
    const chartData = (sparklineData || []).map((val: number, i: number) => ({ val, i }));

    return (
        <Card className="bg-zinc-950/50 border-zinc-900 backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-1.5">
                    <CardTitle className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</CardTitle>
                    {tooltip && (
                        <div className="group/tooltip relative">
                            <HelpCircle className="w-3 h-3 text-zinc-700 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 invisible group-hover/tooltip:visible z-50 shadow-2xl backdrop-blur-md">
                                {tooltip}
                            </div>
                        </div>
                    )}
                </div>
                <Icon className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </CardHeader>
            <CardContent>
                <div className="flex items-end justify-between">
                    <div>
                        <div className="text-2xl font-bold text-zinc-100">{value}</div>
                        <div className={`text-xs mt-1 font-medium ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-zinc-500'}`}>
                            {delta} {trend !== 'neutral' && <span className="text-zinc-600 font-normal ml-1">vs prev</span>}
                        </div>
                    </div>
                    {chartData.length > 0 && (
                        <div className="h-10 w-20 mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <Line
                                        type="monotone"
                                        dataKey="val"
                                        stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#f43f5e' : '#3b82f6'}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={true}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
