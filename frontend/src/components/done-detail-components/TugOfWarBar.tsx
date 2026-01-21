'use client';

import React from 'react';

interface TugOfWarBarProps {
    buyPct: number;
    sellPct: number;
    netValue: number;
    buyValue: number;
    sellValue: number;
}

const formatRupiah = (value: number): string => {
    if (Math.abs(value) >= 1e12) return `Rp ${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `Rp ${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `Rp ${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `Rp ${(value / 1e3).toFixed(0)}K`;
    return `Rp ${value.toFixed(0)}`;
};

export function TugOfWarBar({ buyPct, sellPct, netValue, buyValue, sellValue }: TugOfWarBarProps) {
    const isNetBuy = netValue >= 0;

    return (
        <div className="w-full relative py-4">
            {/* Labels Top */}
            <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-teal-400">BUYERS {buyPct.toFixed(1)}%</span>
                <span className="text-red-400">SELLERS {sellPct.toFixed(1)}%</span>
            </div>

            {/* The BAR */}
            <div className="h-8 w-full bg-slate-800 rounded-full overflow-hidden relative border border-slate-700 shadow-inner">
                {/* Buy Side */}
                <div
                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-teal-900 to-teal-500 transition-all duration-700 ease-out"
                    style={{ width: `${buyPct}%` }}
                />

                {/* Sell Side */}
                <div
                    className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-red-900 to-red-500 transition-all duration-700 ease-out"
                    style={{ width: `${sellPct}%` }}
                // Note: If percentages don't sum to 100 perfectly due to rounding, gaps might appear. 
                // Usually better to just use one bar pushing against the other, 
                // or just left bar width = buyPct, remaining is sell background.
                // But here we want the look of two opposing forces.
                />

                {/* Net Flow Marker (The "Knot") */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-white z-10 shadow-[0_0_10px_white]"
                    style={{ left: `${buyPct}%`, transform: 'translateX(-50%)' }}
                />
            </div>

            {/* Floating Net Value Badge */}
            <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-3 py-1 rounded-full border shadow-xl backdrop-blur-sm font-black text-sm whitespace-nowrap transition-colors duration-500
                    ${isNetBuy
                        ? 'bg-teal-950/80 border-teal-500 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                        : 'bg-red-950/80 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                    }`}
            >
                {isNetBuy ? 'NET BUY' : 'NET SELL'} {formatRupiah(Math.abs(netValue))}
            </div>

            {/* Raw Values Below */}
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
                <span>{formatRupiah(buyValue)}</span>
                <span>{formatRupiah(sellValue)}</span>
            </div>
        </div>
    );
}
