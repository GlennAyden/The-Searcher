'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PowerMeterProps {
    buyPower: number;
    sellPower: number;
}

export function PowerMeter({ buyPower, sellPower }: PowerMeterProps) {
    const data = [
        { name: 'Sellers', value: sellPower, color: '#f87171' }, // Red-400
        { name: 'Buyers', value: buyPower, color: '#4ade80' },   // Green-400
    ];

    const dominance = buyPower > sellPower ? 'Buyers' : sellPower > buyPower ? 'Sellers' : 'Neutral';
    const color = buyPower > sellPower ? 'text-green-400' : sellPower > buyPower ? 'text-red-400' : 'text-gray-400';

    return (
        <div className="flex flex-col items-center justify-center p-2 relative h-full">
            <div className="w-full h-36 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="80%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                            startAngle={180}
                            endAngle={0}
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Label */}
                <div className="absolute inset-x-0 bottom-2 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold opacity-50">Dominance</span>
                    <span className={`text-xl font-black tracking-tighter ${color}`}>{dominance.toUpperCase()}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-white font-mono text-xs font-bold bg-white/5 px-1.5 py-0.5 rounded">
                            {Math.max(buyPower, sellPower).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex w-full justify-between items-end px-2 mt-auto pb-1">
                <div className="flex flex-col">
                    <div className="text-[8px] text-gray-600 uppercase font-black">Sellers</div>
                    <div className="text-xs font-mono font-bold text-red-500">{sellPower.toFixed(1)}%</div>
                </div>
                <div className="flex flex-col text-right">
                    <div className="text-[8px] text-gray-600 uppercase font-black">Buyers</div>
                    <div className="text-xs font-mono font-bold text-green-500">{buyPower.toFixed(1)}%</div>
                </div>
            </div>
        </div>
    );
}
