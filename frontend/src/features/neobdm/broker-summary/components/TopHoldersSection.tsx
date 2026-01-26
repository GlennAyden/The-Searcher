'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Info, RefreshCcw, TrendingUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopHolderItem } from '@/services/api/neobdm';

type TopHoldersSectionProps = {
    ticker: string;
    topHolders: TopHolderItem[];
    loading: boolean;
    formatNumber: (value: unknown, digits?: number) => string;
};

export function TopHoldersSection({ ticker, topHolders, loading, formatNumber }: TopHoldersSectionProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Top 3 Holders - {ticker || 'Select a ticker'}
            </h2>

            {loading ? (
                <div className="h-[200px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : topHolders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {topHolders.map((holder, idx) => {
                        const rankColors = [
                            { border: 'border-amber-500/40', bg: 'bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
                            { border: 'border-zinc-500/40', bg: 'bg-zinc-500/5', badge: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30' },
                            { border: 'border-orange-700/40', bg: 'bg-orange-700/5', badge: 'bg-orange-700/20 text-orange-400 border border-orange-700/30' },
                        ];
                        const color = rankColors[idx] || rankColors[2];

                        return (
                            <motion.div
                                key={holder.broker_code}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={cn(
                                    'bg-gradient-to-br from-zinc-900/80 to-zinc-900/50 border rounded-2xl p-5 space-y-3 shadow-lg',
                                    color.border
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={cn('text-xs px-3 py-1 rounded-full font-black', color.badge)}>
                                        #{idx + 1} HOLDER
                                    </div>
                                </div>

                                <div>
                                    <div className="text-3xl font-black text-white tracking-tight">
                                        {holder.broker_code}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-zinc-800">
                                    <div>
                                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1 flex items-center gap-1">
                                            Total Net Lot (Sisa Barang)
                                            <div className="group relative">
                                                <Info className="w-3 h-3 text-zinc-700 hover:text-zinc-500 cursor-help" />
                                                <div className="invisible group-hover:visible absolute left-0 top-4 w-48 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-[9px] text-zinc-300 normal-case font-normal shadow-xl z-50">
                                                    NET position (Buy - Sell). Menunjukkan akumulasi sebenarnya setelah memperhitungkan buy dan sell.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                                            +{formatNumber(holder.total_net_lot)} lot
                                            <TrendingUp className="w-5 h-5" />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-[9px] text-zinc-600 font-bold uppercase mb-1">
                                            Total Net Value
                                        </div>
                                        <div className="text-lg font-black text-blue-400">
                                            {formatNumber(holder.total_net_value, 1)}B
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800/50">
                                    <div>
                                        <div className="text-zinc-600 font-bold">Trades</div>
                                        <div className="text-zinc-400 font-black">{holder.trade_count} days</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-zinc-600 font-bold">Period</div>
                                        <div className="text-zinc-400 font-black">
                                            {holder.first_date.substring(5)} - {holder.last_date.substring(5)}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            ) : ticker && ticker.length >= 4 ? (
                <div className="h-[200px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="text-zinc-600 text-sm font-bold">No top holders data</div>
                        <div className="text-zinc-700 text-xs">
                            No broker summary data available for {ticker}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-[200px] bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-2" />
                        <div className="text-zinc-600 text-sm font-bold">Enter a ticker to see top holders</div>
                    </div>
                </div>
            )}
        </div>
    );
}
