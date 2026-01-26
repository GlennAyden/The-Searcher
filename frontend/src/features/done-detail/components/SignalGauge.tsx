'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface SignalGaugeProps {
    value: number; // 0 to 100
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    label: string;
}

export function SignalGauge({ value, direction, label }: SignalGaugeProps) {
    // Gauge segments
    const data = [
        { name: 'Bearish', value: 33, color: '#ef4444' }, // Red-500
        { name: 'Neutral', value: 34, color: '#64748b' }, // Slate-500
        { name: 'Bullish', value: 33, color: '#14b8a6' }, // Teal-500
    ];

    return (
        <div className="relative w-full h-[120px] flex flex-col items-center justify-center">
            {/* Chart Layer */}
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="80%" // Move chart down so we only see top half
                        startAngle={180}
                        endAngle={0}
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>

            {/* Needle Layer (CSS Rotation) */}
            <div
                className="absolute bottom-[20%] left-1/2 w-1 h-[65px] bg-white origin-bottom -translate-x-1/2 rounded-full z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-700 ease-out"
                style={{
                    transform: `translateX(-50%) rotate(${(value / 100) * 180 - 90}deg)`
                }}
            >
                <div className="absolute -bottom-2 -left-1.5 w-4 h-4 bg-white rounded-full border-2 border-slate-900" />
            </div>

            {/* Label */}
            <div className="absolute bottom-0 text-center">
                <div className="text-2xl font-black text-white">{value}%</div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded ${direction === 'BULLISH' ? 'bg-teal-500/20 text-teal-400' :
                        direction === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                            'bg-slate-500/20 text-slate-400'
                    }`}>
                    {label}
                </div>
            </div>
        </div>
    );
}
