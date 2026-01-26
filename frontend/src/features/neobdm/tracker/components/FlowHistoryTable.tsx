'use client';

import React from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChartRow } from '../types';

type FlowHistoryTableProps = {
    chartData: ChartRow[];
    loading: boolean;
};

export function FlowHistoryTable({ chartData, loading }: FlowHistoryTableProps) {
    return (
        <div className="bg-[#181a1f] border border-zinc-800/50 rounded-md overflow-hidden">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-zinc-500" />
                    <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-widest">Historical Breakdown</h3>
                </div>
                <div className="text-[9px] text-zinc-500 italic uppercase">
                    All flow values in <span className="text-blue-400 font-bold">Billions IDR (Miliar)</span>
                </div>
            </div>
            <div className="max-h-[300px] overflow-auto scrollbar-thin scrollbar-thumb-zinc-800">
                <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-[#23252b] z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Date</th>
                            <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Price</th>
                            <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Change</th>
                            <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">Money Flow</th>
                            <th className="px-4 py-2 border-r border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider text-center">Markers</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {chartData.slice().reverse().map((row, idx) => (
                            <tr key={idx} className="hover:bg-zinc-800/40 transition-colors h-[32px]">
                                <td className="px-4 py-1.5 border-r border-zinc-800 text-zinc-400 font-mono">{row.scraped_at}</td>
                                <td className="px-4 py-1.5 border-r border-zinc-800 text-zinc-200 font-bold">{row.price?.toLocaleString()}</td>
                                <td className={cn('px-4 py-1.5 border-r border-zinc-800 font-bold', (row.change || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                    <div className="flex flex-col leading-tight">
                                        <span>{(row.change || 0) > 0 && '+'}{row.change?.toLocaleString()}</span>
                                        <span className="text-[9px] opacity-70">({(row.pct_change || 0) > 0 && '+'}{row.pct_change?.toFixed(2)}%)</span>
                                    </div>
                                </td>
                                <td className={cn('px-4 py-1.5 border-r border-zinc-800 font-bold', (row.activeFlow ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                    {row.activeFlow?.toLocaleString()} <span className="text-[8px] opacity-40">B</span>
                                </td>
                                <td className="px-4 py-1.5 border-r border-zinc-800 text-center">
                                    <div className="flex justify-center gap-1">
                                        {row.isCrossing && <div className="w-2 h-2 rounded-full bg-pink-500 shadow-sm shadow-pink-500/50" title="Crossing" />}
                                        {row.isUnusual && <div className="w-2 h-2 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" title="Unusual" />}
                                        {row.isPinky && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" title="Pinky" />}
                                        {!row.isCrossing && !row.isUnusual && !row.isPinky && <span className="text-zinc-700">-</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {chartData.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-zinc-600 italic">No historical data available. Perform a sync first.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
