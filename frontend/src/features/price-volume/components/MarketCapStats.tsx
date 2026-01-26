'use client';

import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { MarketCapResponse } from '@/services/api/priceVolume';

type MarketCapStatsProps = {
    marketCapData: MarketCapResponse | null;
};

export function MarketCapStats({ marketCapData }: MarketCapStatsProps) {
    if (!marketCapData || !marketCapData.current_market_cap) {
        return null;
    }

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-zinc-100">Market Capitalization</h3>
                <span className="text-xs text-zinc-500">Based on {marketCapData.history_count} trading days</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-800/50 rounded-lg p-2.5">
                    <div className="text-xs text-zinc-500 mb-1">Current Market Cap</div>
                    <div className="text-lg font-bold text-cyan-400">
                        {marketCapData.current_market_cap >= 1e12
                            ? `Rp ${(marketCapData.current_market_cap / 1e12).toFixed(1)}T`
                            : marketCapData.current_market_cap >= 1e9
                                ? `Rp ${(marketCapData.current_market_cap / 1e9).toFixed(1)}B`
                                : `Rp ${(marketCapData.current_market_cap / 1e6).toFixed(1)}M`
                        }
                    </div>
                </div>

                {marketCapData.shares_outstanding && (
                    <div className="bg-zinc-800/50 rounded-lg p-2.5">
                        <div className="text-xs text-zinc-500 mb-1">Shares Outstanding</div>
                        <div className="text-base font-semibold text-zinc-100">
                            {(marketCapData.shares_outstanding / 1e9).toFixed(2)}B
                        </div>
                    </div>
                )}

                {marketCapData.change_7d_pct !== null && (
                    <div className="bg-zinc-800/50 rounded-lg p-2.5">
                        <div className="text-xs text-zinc-500 mb-1">7D Change</div>
                        <div className={`text-base font-semibold flex items-center gap-1 ${marketCapData.change_7d_pct > 0 ? 'text-emerald-400' :
                            marketCapData.change_7d_pct < 0 ? 'text-red-400' : 'text-zinc-400'
                            }`}>
                            {marketCapData.change_7d_pct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
                                marketCapData.change_7d_pct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
                                    <Minus className="w-3.5 h-3.5" />}
                            {marketCapData.change_7d_pct > 0 ? '+' : ''}{marketCapData.change_7d_pct}%
                        </div>
                    </div>
                )}

                {marketCapData.change_30d_pct !== null && (
                    <div className="bg-zinc-800/50 rounded-lg p-2.5">
                        <div className="text-xs text-zinc-500 mb-1">30D Change</div>
                        <div className={`text-base font-semibold flex items-center gap-1 ${marketCapData.change_30d_pct > 0 ? 'text-emerald-400' :
                            marketCapData.change_30d_pct < 0 ? 'text-red-400' : 'text-zinc-400'
                            }`}>
                            {marketCapData.change_30d_pct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
                                marketCapData.change_30d_pct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
                                    <Minus className="w-3.5 h-3.5" />}
                            {marketCapData.change_30d_pct > 0 ? '+' : ''}{marketCapData.change_30d_pct}%
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
