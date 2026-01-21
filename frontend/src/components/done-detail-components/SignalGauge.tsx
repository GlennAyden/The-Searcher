'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface SignalGaugeProps {
    value: number; // 0 to 100
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    label: string;
}

const RADIAN = Math.PI / 180;

export function SignalGauge({ value, direction, label }: SignalGaugeProps) {
    // Gauge segments
    const data = [
        { name: 'Bearish', value: 33, color: '#ef4444' }, // Red-500
        { name: 'Neutral', value: 34, color: '#64748b' }, // Slate-500
        { name: 'Bullish', value: 33, color: '#14b8a6' }, // Teal-500
    ];

    // Calculate needle rotation
    // Value 0 -> 180 deg (Left)
    // Value 50 -> 90 deg (Top)
    // Value 100 -> 0 deg (Right)
    const needleRotation = 180 - (value / 100) * 180;

    // Needle component
    const needle = (
        <g transform={`rotate(${needleRotation - 90} 100 100)`}>
            {/* Center Circle */}
            <circle cx="100" cy="100" r="8" fill="#fff" />
            {/* Needle Shape */}
            <path d="M 100 100 L 80 100 L 100 15 L 120 100 Z" fill="#fff" transform="translate(-100, -100) rotate(90 100 100)" />
            {/* Note: The rotate arithmetic above can be tricky in SVG, 
                 simplest is drawing a horizontal needle from center to left then rotating it.
                 Let's try a simpler path approach:
                 Center is 100,100.
                 Tip is calculated based on angle.
             */}
        </g>
    );

    // Simpler Needle Logic: Draw a line from center to coordinates
    const cx = 100;
    const cy = 90; // Move up slightly to fit half donut
    const iR = 40;
    const oR = 80;
    const ang = 180 - (value / 100) * 180;
    const length = 60;

    const sin = Math.sin(-RADIAN * ang);
    const cos = Math.cos(-RADIAN * ang);

    // Needle Tip coordinates
    const x0 = cx + (length * cos);
    const y0 = cy + (length * sin); // This might need adjustment for correct coordinate system

    // Correct Recharts logic for Gauge Needle usually involves custom render
    // But since Recharts is tricky for pure custom SVG drawing mixed in, 
    // let's use a standard Half-Donut and overlay a CSS-rotated needle div instead for easier control.

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
