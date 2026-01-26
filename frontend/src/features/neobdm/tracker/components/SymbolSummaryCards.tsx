'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { cleanTickerSymbol } from '@/lib/string-utils';
import type { ChartRow } from '../types';

type SymbolSummaryCardsProps = {
    symbol: string;
    method: string;
    chartData: ChartRow[];
};

export function SymbolSummaryCards({ symbol, method, chartData }: SymbolSummaryCardsProps) {
    const netFlow = chartData.reduce((acc, curr) => acc + (curr.activeFlow ?? 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Active Ticker</span>
                <div className="flex items-baseline gap-2">
                    <h2 className="text-2xl font-black text-blue-400">
                        {cleanTickerSymbol(symbol)}
                    </h2>
                    <span className="text-[10px] text-zinc-600 font-bold">
                        {method === 'm' ? 'Market Maker' : method === 'nr' ? 'Non-Retail' : 'Foreign Flow'}
                    </span>
                </div>
            </div>
            {chartData.length > 0 && (
                <>
                    <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Latest Price</span>
                        <div className="text-2xl font-black text-white">
                            {chartData[chartData.length - 1].price?.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Total Markers (30D)</span>
                        <div className="flex gap-2">
                            <div className="text-2xl font-black text-pink-500">
                                {chartData.filter(d => d.isCrossing || d.isUnusual || d.isPinky).length}
                            </div>
                            <div className="text-[8px] flex flex-col justify-center text-zinc-500 leading-tight">
                                <span>Detected</span>
                                <span>Potential Accum</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[#181a1f] p-3 border border-zinc-800/50 rounded-md">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-widest mb-1">Net Flow Trend</span>
                        <div className={cn(
                            'text-[14px] font-black tracking-tighter',
                            netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                            {netFlow >= 0 ? 'ACCUMULATING' : 'DISTRIBUTING'}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
